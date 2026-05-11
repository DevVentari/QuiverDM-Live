import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  WriteSink,
  UpsertResult,
  PendingChange,
  AiAttemptRecord,
} from './ddb-write-sink';
import type { ChapterContent, DdbMonsterData } from '@/lib/ddb-sourcebook';
import type { ProseChunk } from './ddb-chapter-chunker';

interface ChapterCapture {
  chapterId: string;
  chapterSlug: string;
  chapterIndex: number;
  dirName: string;
  fetched?: {
    proseLength: number;
    monsterLinkCount: number;
    encounterAreaCount: number;
    contentHash: string;
  };
  monsters: Array<{ id: string; payload: DdbMonsterData & { sourceSlug: string } }>;
  monstersSkipped: Array<{ ddbId: string; slug: string; reason: string; status?: number; via?: 'jwt' | 'cookie'; finalUrl?: string; htmlSnippet?: string }>;
  encounters: Array<{ id: string; campaignId: string; areaName: string; description?: string; monsters?: string[]; difficulty?: string }>;
  npcs: Array<{ id: string; campaignId: string; name: string; role?: string; description: string; location?: string }>;
  locations: Array<{ id: string; campaignId: string; name: string; locationType?: string; description: string; notable?: string }>;
  items: Array<{ id: string; userId: string; name: string; itemType?: string; rarity?: string; description: string; imageUrl?: string }>;
  spells: Array<{ id: string; userId: string; name: string; level: number; school: string; castingTime: string; range: string; components: string; duration: string; description: string; higherLevels?: string; classes?: string[] }>;
  feats: Array<{ id: string; userId: string; name: string; prerequisite?: string; description: string; benefits: string[] }>;
  ai: AiAttemptRecord[];
  ragChunks: ProseChunk[];
  issues: Array<{ severity: string; message: string }>;
  status?: string;
  finalHash?: string;
  pendingChanges: PendingChange[];
}

export interface DryRunSummary {
  sourcebook: { slug: string; title?: string };
  generatedAt: string;
  totals: {
    chapters: number;
    monstersExtracted: number;
    monstersSkipped: number;
    encounters: number;
    items: number;
    spells: number;
    feats: number;
    npcs: number;
    locations: number;
    sectionsTotal: number;
    sectionsParsed: number;
    sectionsFailed: number;
    issues: number;
  };
  chapters: Array<{
    index: number;
    slug: string;
    proseLength: number;
    monsterLinkCount: number;
    encounterAreaCount: number;
    monstersExtracted: number;
    monstersSkipped: number;
    encounters: number;
    items: number;
    spells: number;
    feats: number;
    npcs: number;
    locations: number;
    aiSections: number;
    aiSectionsParsed: number;
    aiSectionsFailed: number;
    issueCount: number;
    durationMs?: number;
  }>;
  knownGaps: string[];
}

export class DryRunWriteSink implements WriteSink {
  private chapters = new Map<string, ChapterCapture>();
  private chapterTimings = new Map<string, number>();
  public sourcebookSlug: string;
  public sourcebookTitle?: string;
  public outDir: string;

  constructor(args: { outDir: string; sourcebookSlug: string; sourcebookTitle?: string }) {
    this.outDir = args.outDir;
    this.sourcebookSlug = args.sourcebookSlug;
    this.sourcebookTitle = args.sourcebookTitle;
  }

  async init(): Promise<void> {
    await fs.mkdir(path.join(this.outDir, 'chapters'), { recursive: true });
  }

  beginChapter(args: { chapterId: string; chapterSlug: string; chapterIndex: number }): ChapterCapture {
    const dirName = `${String(args.chapterIndex).padStart(3, '0')}-${args.chapterSlug}`;
    const cap: ChapterCapture = {
      chapterId: args.chapterId,
      chapterSlug: args.chapterSlug,
      chapterIndex: args.chapterIndex,
      dirName,
      monsters: [],
      monstersSkipped: [],
      encounters: [],
      npcs: [],
      locations: [],
      items: [],
      spells: [],
      feats: [],
      ai: [],
      ragChunks: [],
      issues: [],
      pendingChanges: [],
    };
    this.chapters.set(args.chapterId, cap);
    return cap;
  }

  recordChapterTiming(chapterId: string, ms: number): void {
    this.chapterTimings.set(chapterId, ms);
  }

  private getCapture(chapterId: string): ChapterCapture {
    const cap = this.chapters.get(chapterId);
    if (!cap) throw new Error(`No capture initialised for chapter ${chapterId}`);
    return cap;
  }

  async upsertMonster({ chapterId, sourceSlug, monster }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    monster: DdbMonsterData;
  }): Promise<UpsertResult> {
    const cap = this.getCapture(chapterId);
    const id = `dry-monster-${randomUUID()}`;
    cap.monsters.push({ id, payload: { ...monster, sourceSlug } });
    return { created: true, id };
  }

  async upsertEncounter({ campaignId, chapterId, areaName, description, monsters, difficulty }: {
    campaignId: string;
    chapterId: string;
    chapterSlug: string;
    areaName: string;
    description?: string;
    monsters?: string[];
    difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  }): Promise<UpsertResult> {
    const cap = this.getCapture(chapterId);
    const id = `dry-encounter-${randomUUID()}`;
    cap.encounters.push({ id, campaignId, areaName, description, monsters, difficulty });
    return { created: true, id };
  }

  async upsertItem({ userId, chapterId, name, itemType, rarity, description, imageUrl }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    itemType?: string;
    rarity?: string;
    description: string;
    imageUrl?: string;
  }): Promise<UpsertResult> {
    const cap = this.getCapture(chapterId);
    const id = `dry-item-${randomUUID()}`;
    cap.items.push({ id, userId, name, itemType, rarity, description, imageUrl });
    return { created: true, id };
  }

  async upsertSpell({ userId, chapterId, name, level, school, castingTime, range, components, duration, description, higherLevels, classes }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string;
    duration: string;
    description: string;
    higherLevels?: string;
    classes?: string[];
  }): Promise<UpsertResult> {
    const cap = this.getCapture(chapterId);
    const id = `dry-spell-${randomUUID()}`;
    cap.spells.push({ id, userId, name, level, school, castingTime, range, components, duration, description, higherLevels, classes });
    return { created: true, id };
  }

  async upsertFeat({ userId, chapterId, name, prerequisite, description, benefits }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    prerequisite?: string;
    description: string;
    benefits: string[];
  }): Promise<UpsertResult> {
    const cap = this.getCapture(chapterId);
    const id = `dry-feat-${randomUUID()}`;
    cap.feats.push({ id, userId, name, prerequisite, description, benefits });
    return { created: true, id };
  }

  async upsertWorldEntity(args: {
    campaignId: string;
    chapterId: string;
    type: 'NPC' | 'LOCATION';
    name: string;
    description: string;
    role?: string;
    location?: string;
    locationType?: string;
    notable?: string;
  }): Promise<UpsertResult> {
    const cap = this.getCapture(args.chapterId);
    const id = `dry-${args.type.toLowerCase()}-${randomUUID()}`;
    if (args.type === 'NPC') {
      cap.npcs.push({ id, campaignId: args.campaignId, name: args.name, role: args.role, description: args.description, location: args.location });
    } else {
      cap.locations.push({ id, campaignId: args.campaignId, name: args.name, locationType: args.locationType, description: args.description, notable: args.notable });
    }
    return { created: true, id };
  }

  async upsertSourcebookEntity(args: {
    sourcebookId: string;
    chapterId: string;
    type: string;
    name: string;
    description: string;
    properties?: Record<string, unknown>;
  }): Promise<UpsertResult> {
    const id = `dry-sbe-${randomUUID()}`;
    // No-op artifact bucket for dry-run; full capture lives in upsertWorldEntity already.
    void args;
    return { created: true, id };
  }

  async setChapterStatus(chapterId: string, status: 'running' | 'idle' | 'error'): Promise<void> {
    const cap = this.chapters.get(chapterId);
    if (cap) cap.status = status;
  }

  async finalizeChapter({ chapterId, contentHash, pendingChanges }: {
    chapterId: string;
    contentHash: string;
    pendingChanges: PendingChange[];
  }): Promise<void> {
    const cap = this.getCapture(chapterId);
    cap.finalHash = contentHash;
    cap.pendingChanges = pendingChanges;
  }

  async recordFetched({ chapterId, content }: {
    chapterId: string;
    chapterSlug: string;
    chapterIndex: number;
    content: ChapterContent;
  }): Promise<void> {
    const cap = this.getCapture(chapterId);
    cap.fetched = {
      proseLength: content.prose.length,
      monsterLinkCount: content.monsterLinks.length,
      encounterAreaCount: content.encounterAreas.length,
      contentHash: content.contentHash,
    };
    const dir = path.join(this.outDir, 'chapters', cap.dirName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'fetched.json'),
      JSON.stringify({
        chapterIndex: cap.chapterIndex,
        chapterSlug: cap.chapterSlug,
        contentHash: content.contentHash,
        proseLength: content.prose.length,
        monsterLinks: content.monsterLinks,
        encounterAreas: content.encounterAreas,
      }, null, 2)
    );
    await fs.writeFile(path.join(dir, 'prose.txt'), content.prose);
  }

  async recordSkippedMonster(args: {
    chapterId: string;
    ddbId: string;
    slug: string;
    reason: string;
    status?: number;
    via?: 'jwt' | 'cookie';
    finalUrl?: string;
    htmlSnippet?: string;
  }): Promise<void> {
    const cap = this.getCapture(args.chapterId);
    cap.monstersSkipped.push({
      ddbId: args.ddbId,
      slug: args.slug,
      reason: args.reason,
      status: args.status,
      via: args.via,
      finalUrl: args.finalUrl,
      htmlSnippet: args.htmlSnippet,
    });
  }

  async recordAiAttempt(record: AiAttemptRecord): Promise<void> {
    const cap = this.getCapture(record.chapterId);
    cap.ai.push(record);
  }

  async recordIssue({ chapterId, severity, message }: {
    chapterId: string;
    severity: 'info' | 'warn' | 'error';
    message: string;
  }): Promise<void> {
    const cap = this.chapters.get(chapterId);
    if (cap) cap.issues.push({ severity, message });
  }

  async ingestChapterProse({ chapterId, chunks }: {
    chapterId: string;
    chapterSlug: string;
    sourceSlug: string;
    campaignIds: string[];
    chunks: ProseChunk[];
  }): Promise<{ embedded: number; skipped: number }> {
    const cap = this.getCapture(chapterId);
    cap.ragChunks = chunks;
    // Dry-run does not actually embed — captures chunks so we can review what
    // would be embedded. Returns embedded=0 to signal "captured, not embedded".
    return { embedded: 0, skipped: chunks.length };
  }

  async linkEncounterCreatures(_args: {
    planId: string;
    userId: string;
    monsterNames: string[];
  }): Promise<{ linked: number; unmatched: number }> {
    // Dry-run captures the monster name list on the encounter row already.
    // No DB-side resolution to perform.
    return { linked: 0, unmatched: 0 };
  }

  async flushChapter(chapterId: string): Promise<void> {
    const cap = this.getCapture(chapterId);
    const dir = path.join(this.outDir, 'chapters', cap.dirName);
    await fs.mkdir(dir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(dir, 'monsters.json'), JSON.stringify(cap.monsters, null, 2)),
      fs.writeFile(path.join(dir, 'monsters-skipped.json'), JSON.stringify(cap.monstersSkipped, null, 2)),
      fs.writeFile(path.join(dir, 'encounters.json'), JSON.stringify(cap.encounters, null, 2)),
      fs.writeFile(path.join(dir, 'items.json'), JSON.stringify(cap.items, null, 2)),
      fs.writeFile(path.join(dir, 'spells.json'), JSON.stringify(cap.spells, null, 2)),
      fs.writeFile(path.join(dir, 'feats.json'), JSON.stringify(cap.feats, null, 2)),
      fs.writeFile(
        path.join(dir, 'world-entities.json'),
        JSON.stringify({ npcs: cap.npcs, locations: cap.locations }, null, 2)
      ),
      fs.writeFile(path.join(dir, 'pending-changes.json'), JSON.stringify(cap.pendingChanges, null, 2)),
      fs.writeFile(
        path.join(dir, 'rag-chunks.json'),
        JSON.stringify(
          {
            chunkCount: cap.ragChunks.length,
            totalChars: cap.ragChunks.reduce((n, c) => n + c.charLength, 0),
            estimatedTokens: cap.ragChunks.reduce((n, c) => n + c.estimatedTokens, 0),
            chunks: cap.ragChunks,
          },
          null,
          2
        )
      ),
      this.writeIssuesMd(dir, cap),
      this.writeAiCapture(dir, cap),
    ]);
  }

  private async writeIssuesMd(dir: string, cap: ChapterCapture): Promise<void> {
    const lines: string[] = [
      `# Issues — ${cap.chapterSlug}`,
      '',
      `Status: ${cap.status ?? 'unknown'}`,
      `Final hash: ${cap.finalHash ?? '(not finalized)'}`,
      `Counts: monsters=${cap.monsters.length} (skipped ${cap.monstersSkipped.length}), encounters=${cap.encounters.length}, items=${cap.items.length}, spells=${cap.spells.length}, feats=${cap.feats.length}, npcs=${cap.npcs.length}, locations=${cap.locations.length}`,
      '',
      '## Issues',
    ];
    if (cap.issues.length === 0) {
      lines.push('_(none)_');
    } else {
      for (const issue of cap.issues) lines.push(`- **${issue.severity}**: ${issue.message}`);
    }
    if (cap.monstersSkipped.length > 0) {
      lines.push('', '## Skipped Monsters');
      for (const m of cap.monstersSkipped) {
        const via = m.via ? ` [via ${m.via}]` : '';
        const status = m.status !== undefined ? ` (status ${m.status})` : '';
        lines.push(`- ${m.ddbId} (${m.slug})${via}${status} — ${m.reason}`);
      }
    }
    await fs.writeFile(path.join(dir, 'issues.md'), lines.join('\n'));
  }

  private async writeAiCapture(dir: string, cap: ChapterCapture): Promise<void> {
    if (cap.ai.length === 0) return;
    const aiDir = path.join(dir, 'ai');
    await fs.mkdir(aiDir, { recursive: true });
    // Per-section files
    for (let i = 0; i < cap.ai.length; i++) {
      const a = cap.ai[i];
      const slug = String(i).padStart(2, '0');
      await fs.writeFile(path.join(aiDir, `${slug}-prompt.txt`), a.prompt);
      await fs.writeFile(path.join(aiDir, `${slug}-response.txt`), a.rawResponse);
      await fs.writeFile(
        path.join(aiDir, `${slug}-parsed.json`),
        JSON.stringify(
          {
            parsed: a.parsed,
            parseError: a.parseError,
            sectionLength: a.proseLength,
            durationMs: a.durationMs,
          },
          null,
          2
        )
      );
    }
    // Summary across all sections
    await fs.writeFile(
      path.join(aiDir, 'summary.json'),
      JSON.stringify(
        cap.ai.map((a, i) => ({
          index: i,
          sectionLength: a.proseLength,
          parsed: !!a.parsed,
          parseError: a.parseError,
          durationMs: a.durationMs,
        })),
        null,
        2
      )
    );
  }

  async writeSummary(knownGaps: string[]): Promise<DryRunSummary> {
    const chapters = [...this.chapters.values()].sort((a, b) => a.chapterIndex - b.chapterIndex);
    const summary: DryRunSummary = {
      sourcebook: { slug: this.sourcebookSlug, title: this.sourcebookTitle },
      generatedAt: new Date().toISOString(),
      totals: {
        chapters: chapters.length,
        monstersExtracted: chapters.reduce((n, c) => n + c.monsters.length, 0),
        monstersSkipped: chapters.reduce((n, c) => n + c.monstersSkipped.length, 0),
        encounters: chapters.reduce((n, c) => n + c.encounters.length, 0),
        items: chapters.reduce((n, c) => n + c.items.length, 0),
        spells: chapters.reduce((n, c) => n + c.spells.length, 0),
        feats: chapters.reduce((n, c) => n + c.feats.length, 0),
        npcs: chapters.reduce((n, c) => n + c.npcs.length, 0),
        locations: chapters.reduce((n, c) => n + c.locations.length, 0),
        sectionsTotal: chapters.reduce((n, c) => n + c.ai.length, 0),
        sectionsParsed: chapters.reduce((n, c) => n + c.ai.filter(a => a.parsed && !a.parseError).length, 0),
        sectionsFailed: chapters.reduce((n, c) => n + c.ai.filter(a => a.parseError && a.parseError !== 'skipped').length, 0),
        issues: chapters.reduce((n, c) => n + c.issues.length, 0),
      },
      chapters: chapters.map(c => ({
        index: c.chapterIndex,
        slug: c.chapterSlug,
        proseLength: c.fetched?.proseLength ?? 0,
        monsterLinkCount: c.fetched?.monsterLinkCount ?? 0,
        encounterAreaCount: c.fetched?.encounterAreaCount ?? 0,
        monstersExtracted: c.monsters.length,
        monstersSkipped: c.monstersSkipped.length,
        encounters: c.encounters.length,
        items: c.items.length,
        spells: c.spells.length,
        feats: c.feats.length,
        npcs: c.npcs.length,
        locations: c.locations.length,
        aiSections: c.ai.length,
        aiSectionsParsed: c.ai.filter(a => a.parsed && !a.parseError).length,
        aiSectionsFailed: c.ai.filter(a => a.parseError && a.parseError !== 'skipped').length,
        issueCount: c.issues.length,
        durationMs: this.chapterTimings.get(c.chapterId),
      })),
      knownGaps,
    };

    await fs.writeFile(path.join(this.outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    await this.writeSummaryMd(summary);
    return summary;
  }

  private async writeSummaryMd(s: DryRunSummary): Promise<void> {
    const lines = [
      `# DDB Dry-Run — ${s.sourcebook.title ?? s.sourcebook.slug}`,
      '',
      `Generated: ${s.generatedAt}`,
      `Slug: \`${s.sourcebook.slug}\``,
      '',
      '## Totals',
      `- Chapters: ${s.totals.chapters}`,
      `- Monsters extracted: ${s.totals.monstersExtracted} (skipped ${s.totals.monstersSkipped})`,
      `- Encounters: ${s.totals.encounters}`,
      `- NPCs: ${s.totals.npcs}`,
      `- Locations: ${s.totals.locations}`,
      `- Items: ${s.totals.items}`,
      `- Spells: ${s.totals.spells}`,
      `- Feats: ${s.totals.feats}`,
      `- AI sections: ${s.totals.sectionsTotal} total, ${s.totals.sectionsParsed} parsed, ${s.totals.sectionsFailed} failed`,
      `- Issues logged: ${s.totals.issues}`,
      '',
      '## Per-chapter',
      '',
      '| # | slug | prose | links | areas | monsters | encs | items | npcs | locs | AI | issues | dur |',
      '|---|------|------:|------:|------:|---------:|-----:|------:|-----:|-----:|----|-------:|----:|',
    ];
    for (const c of s.chapters) {
      const ai = `${c.aiSectionsParsed}/${c.aiSections}` + (c.aiSectionsFailed > 0 ? ` (${c.aiSectionsFailed} fail)` : '');
      const dur = c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : '';
      lines.push(
        `| ${c.index} | ${c.slug} | ${c.proseLength} | ${c.monsterLinkCount} | ${c.encounterAreaCount} | ${c.monstersExtracted} | ${c.encounters} | ${c.items} | ${c.npcs} | ${c.locations} | ${ai} | ${c.issueCount} | ${dur} |`
      );
    }
    if (s.knownGaps.length > 0) {
      lines.push('', '## Known gaps (flagged before run)', '');
      for (const g of s.knownGaps) lines.push(`- ${g}`);
    }
    await fs.writeFile(path.join(this.outDir, 'summary.md'), lines.join('\n'));
  }
}
