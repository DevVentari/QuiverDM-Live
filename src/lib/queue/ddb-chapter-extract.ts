import { fetchChapterContentWithCookie, fetchMonsterData, delay } from '@/lib/ddb-sourcebook';
import type { FetchMonsterResult, ChapterImage } from '@/lib/ddb-sourcebook';
import { decrypt } from '@/lib/encryption';
import { extractChapterEntities } from '@/lib/ai/extract-chapter-entities';
import { prisma } from '@/lib/prisma';
import type { WriteSink, PendingChange, AiAttemptRecord } from './ddb-write-sink';
import type { DdbChapterExtractJobData } from './ddb-sync-queue';
import { chunkChapterProse } from './ddb-chapter-chunker';

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Heuristic image matcher: returns a function mapping an entity name to its
 * best image URL among the chapter's <img> tags. Strategy, in order:
 *   1. Alt-text contains the entity name (substring, normalised).
 *   2. Section heading equals the entity name → first image in that section.
 *   3. Section heading contains the entity name → first image in that section.
 *   4. Section heading is contained IN the entity name (entity names can include
 *      qualifiers like "Cragmaw Hideout — Goblin Trail").
 * isHero is no longer required — DDB maps often appear after section text.
 */
function makeImageMatcher(images: ChapterImage[]) {
  const bySection = new Map<string, ChapterImage[]>();
  for (const img of images) {
    const key = norm(img.sectionHeading);
    const arr = bySection.get(key) ?? [];
    arr.push(img);
    bySection.set(key, arr);
  }
  return (entityName: string | null | undefined): string | undefined => {
    const target = norm(entityName);
    if (!target) return undefined;

    // (1) Alt-text match — strongest signal when DDB sets it.
    const byAlt = images.find((img) => {
      const a = norm(img.alt);
      return a.length > 0 && a.includes(target);
    });
    if (byAlt) return byAlt.url;

    // (2) Exact section match.
    const exactImgs = bySection.get(target);
    if (exactImgs && exactImgs.length > 0) return exactImgs[0].url;

    // (3) + (4) Bidirectional substring match on section headings.
    for (const [heading, imgs] of bySection.entries()) {
      if (heading.length === 0 || imgs.length === 0) continue;
      if (heading.includes(target) || target.includes(heading)) {
        return imgs[0].url;
      }
    }
    return undefined;
  };
}

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
  let sourcebookIdForMaster: string | null = null;
  if (!skipChapterRead) {
    const chapter = await prisma.ddbSourcebookChapter.findUnique({
      where: { id: chapterId },
      select: { contentHash: true, sourcebookId: true },
    });
    priorHash = chapter?.contentHash ?? null;
    sourcebookIdForMaster = chapter?.sourcebookId ?? null;
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

  // ── AI: section-aware structured extraction ─────────────────────────────
  // Note: we no longer create EncounterPlan rows from H2 headings — those
  // were scene anchors, not combat encounters, and produced 80%+ noise.
  // Real EncounterPlans come from AI extraction (with monster lists).
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

    // Build a fast lookup: entity name → image URL via section + alt heuristics.
    const findImage = makeImageMatcher(content.images);

    // Sourcebook-scoped master copy — independent of any user campaign.
    // Written once per chapter so deletes of user campaigns don't lose
    // the canonical extracted content.
    if (sourcebookIdForMaster) {
      for (const npc of merged.npcs) {
        if (!npc.name?.trim()) continue;
        await sink.upsertSourcebookEntity({
          sourcebookId: sourcebookIdForMaster,
          chapterId,
          type: 'NPC',
          name: npc.name,
          description: npc.description,
          properties: {
            ...(npc.role ? { role: npc.role } : {}),
            ...(npc.location ? { location: npc.location } : {}),
          },
          imageUrl: findImage(npc.name),
        });
      }
      for (const loc of merged.locations) {
        if (!loc.name?.trim()) continue;
        await sink.upsertSourcebookEntity({
          sourcebookId: sourcebookIdForMaster,
          chapterId,
          type: 'LOCATION',
          name: loc.name,
          description: loc.description,
          properties: {
            ...(loc.type ? { locationType: loc.type } : {}),
            ...(loc.notable ? { notable: loc.notable } : {}),
          },
          imageUrl: findImage(loc.name),
        });
      }
    }

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
          imageUrl: findImage(npc.name),
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
          imageUrl: findImage(loc.name),
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
        imageUrl: findImage(item.name),
      });
    }
    for (const spell of merged.spells ?? []) {
      if (!spell.name?.trim()) continue;
      await sink.upsertSpell({
        userId,
        chapterId,
        sourceSlug,
        name: spell.name,
        level: spell.level,
        school: spell.school,
        castingTime: spell.castingTime,
        range: spell.range,
        components: spell.components,
        duration: spell.duration,
        description: spell.description,
        higherLevels: spell.higherLevels,
        classes: spell.classes,
      });
    }
    for (const feat of merged.feats ?? []) {
      if (!feat.name?.trim()) continue;
      await sink.upsertFeat({
        userId,
        chapterId,
        sourceSlug,
        name: feat.name,
        prerequisite: feat.prerequisite,
        description: feat.description,
        benefits: feat.benefits ?? [],
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
