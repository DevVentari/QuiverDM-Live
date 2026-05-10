import { fetchChapterContentWithCookie, fetchMonsterData, delay } from '@/lib/ddb-sourcebook';
import type { FetchMonsterResult } from '@/lib/ddb-sourcebook';
import { decrypt } from '@/lib/encryption';
import { extractChapterEntities } from '@/lib/ai/extract-chapter-entities';
import { prisma } from '@/lib/prisma';
import type { WriteSink, PendingChange, AiAttemptRecord } from './ddb-write-sink';
import type { DdbChapterExtractJobData } from './ddb-sync-queue';
import { chunkChapterProse } from './ddb-chapter-chunker';

export interface ProcessChapterOptions {
  sink: WriteSink;
  /** When true, skip the AI extraction step entirely (still records what would have been sent). */
  skipAi?: boolean;
  /** When true, skip prisma reads for chapter metadata (used by dry-run with synthetic chapter ids). */
  skipChapterRead?: boolean;
  /** Override chapter index (used by dry-run since we don't have a DdbSourcebookChapter row). */
  chapterIndex?: number;
}

export async function processChapterJob(
  data: DdbChapterExtractJobData,
  opts: ProcessChapterOptions
): Promise<void> {
  const { sink, skipAi = false, skipChapterRead = false, chapterIndex } = opts;
  const { chapterId, userId, sourceSlug, chapterSlug, cobaltJwt, cobaltSessionEncrypted, campaignIds } = data;

  await sink.setChapterStatus(chapterId, 'running');

  const cobaltSession = decrypt(cobaltSessionEncrypted);
  const content = await fetchChapterContentWithCookie(sourceSlug, chapterSlug, cobaltSession);

  await sink.recordFetched({
    chapterId,
    chapterSlug,
    chapterIndex: chapterIndex ?? 0,
    content,
  });

  let priorHash: string | null = null;
  if (!skipChapterRead) {
    const chapter = await prisma.ddbSourcebookChapter.findUnique({ where: { id: chapterId } });
    priorHash = chapter?.contentHash ?? null;
  }
  const isFirstSync = !priorHash;
  const isChanged = !isFirstSync && priorHash !== content.contentHash;

  const pendingChanges: PendingChange[] = [];

  // ── Monsters ────────────────────────────────────────────────────────────
  if (content.monsterLinks.length === 0) {
    await sink.recordIssue({ chapterId, severity: 'info', message: 'No monster links detected on this chapter page.' });
  }
  for (const monster of content.monsterLinks) {
    await delay(500);
    const fetched: FetchMonsterResult = await fetchMonsterData(monster.ddbId, monster.slug, cobaltJwt, cobaltSession);
    if (!fetched.ok) {
      await sink.recordSkippedMonster({
        chapterId,
        ddbId: monster.ddbId,
        slug: monster.slug,
        reason: fetched.reason,
        status: fetched.status,
        via: fetched.via,
        finalUrl: fetched.finalUrl,
        htmlSnippet: fetched.htmlSnippet,
      });
      continue;
    }
    const monsterData = fetched.data;

    const result = await sink.upsertMonster({ userId, chapterId, sourceSlug, monster: monsterData });
    if (!result.created && isChanged && result.existingName && result.existingName !== monsterData.name) {
      pendingChanges.push({
        entityType: 'HomebrewContent',
        entityId: result.id,
        entityName: result.existingName,
        field: 'name',
        oldValue: result.existingName,
        newValue: monsterData.name,
      });
    }
  }

  // ── H2 area shells (still useful as scene anchors; AI fills the detail) ──
  if (isFirstSync) {
    if (content.encounterAreas.length === 0) {
      await sink.recordIssue({ chapterId, severity: 'info', message: 'No H2 encounter areas detected.' });
    }
    for (const campaignId of campaignIds) {
      for (const area of content.encounterAreas) {
        await sink.upsertEncounter({ campaignId, chapterId, chapterSlug, areaName: area });
      }
    }
  }

  // ── AI: section-aware structured extraction ─────────────────────────────
  if (content.sections.length === 0 || content.prose.length < 200) {
    await sink.recordIssue({
      chapterId,
      severity: 'info',
      message: `No sections to extract (sections=${content.sections.length}, prose=${content.prose.length} chars).`,
    });
  } else {
    const aiResult = await extractChapterEntities(chapterSlug, content.sections, { skipAi });

    // Record one AiAttemptRecord per section for audit
    for (const attempt of aiResult.attempts) {
      const aiRecord: AiAttemptRecord = {
        chapterId,
        prompt: attempt.prompt,
        rawResponse: attempt.rawResponse,
        parsed: attempt.parsed,
        parseError: attempt.parseError,
        promptCharLimit: attempt.sectionLength,
        proseLength: attempt.sectionLength,
        truncated: false,
        durationMs: attempt.durationMs,
      };
      await sink.recordAiAttempt(aiRecord);
    }

    const failures = aiResult.attempts.filter(a => a.parseError && a.parseError !== 'skipped');
    if (failures.length > 0) {
      await sink.recordIssue({
        chapterId,
        severity: 'warn',
        message: `AI parse failures in ${failures.length}/${aiResult.attempts.length} sections (first: "${failures[0].sectionHeading}" — ${failures[0].parseError}).`,
      });
    }

    const merged = aiResult.merged;
    for (const campaignId of campaignIds) {
      for (const npc of merged.npcs) {
        if (!npc.name?.trim()) continue;
        await sink.upsertWorldEntity({
          campaignId,
          chapterId,
          type: 'NPC',
          name: npc.name,
          description: npc.description,
          role: npc.role,
          location: npc.location,
        });
      }
      for (const loc of merged.locations) {
        if (!loc.name?.trim()) continue;
        await sink.upsertWorldEntity({
          campaignId,
          chapterId,
          type: 'LOCATION',
          name: loc.name,
          description: loc.description,
          locationType: loc.type,
          notable: loc.notable,
        });
      }
      for (const enc of merged.encounters) {
        if (!enc.name?.trim()) continue;
        await sink.upsertEncounter({
          campaignId,
          chapterId,
          chapterSlug,
          areaName: enc.name,
          description: enc.description,
          monsters: enc.monsters,
          difficulty: enc.difficulty,
        });
      }
    }
    for (const item of merged.items) {
      if (!item.name?.trim()) continue;
      await sink.upsertItem({
        userId,
        chapterId,
        sourceSlug,
        name: item.name,
        itemType: item.type,
        rarity: item.rarity,
        description: item.description,
      });
    }
  }

  // ── RAG: chunk + embed chapter prose ───────────────────────────────────
  if (content.prose.length >= 200 && campaignIds.length > 0) {
    const chunks = chunkChapterProse(content.prose);
    if (chunks.length > 0) {
      const ragResult = await sink.ingestChapterProse({
        chapterId,
        chapterSlug,
        sourceSlug,
        campaignIds,
        chunks,
      });
      if (ragResult.skipped > 0 && ragResult.embedded === 0) {
        await sink.recordIssue({
          chapterId,
          severity: 'info',
          message: `RAG capture only: ${chunks.length} chunks recorded, embedding skipped (dry-run).`,
        });
      } else if (ragResult.skipped > 0) {
        await sink.recordIssue({
          chapterId,
          severity: 'warn',
          message: `RAG: ${ragResult.embedded}/${chunks.length} chunks embedded, ${ragResult.skipped} failed.`,
        });
      }
    }
  }

  await sink.finalizeChapter({ chapterId, contentHash: content.contentHash, pendingChanges });
}
