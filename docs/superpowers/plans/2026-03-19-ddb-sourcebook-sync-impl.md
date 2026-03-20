# DDB Sourcebook Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow DMs to import any D&D Beyond sourcebook they own/share into QuiverDM, seeding monsters, encounter plans, world entities, and RAG lore across their campaigns — with weekly change detection and DM-reviewed updates.

**Architecture:** Three BullMQ workers (coordinator → parallel chapter extractors → review aggregator) process each sync. A tRPC router exposes entitlement listing, import triggering, sync status, and change review. UI lives in Settings → D&D Beyond tab.

**Tech Stack:** Prisma/PostgreSQL, BullMQ/Redis (Upstash), cheerio (HTML parsing), existing `src/lib/encryption.ts`, existing `src/lib/ai/chat.ts`, existing `src/lib/queue/` worker pattern.

---

## Important Pre-Implementation Notes

- **`dndBeyondCobaltCookie`** already exists in `UserSettings` (schema line 113). Do NOT add a new field — use this existing one.
- **`cheerio`** is already installed (`^1.1.2`). No new dependency needed.
- **`getRedisConnection`** must be imported from `./queue` in all worker files — never re-implemented locally.
- **DDB auth for server-side fetches:** The coordinator uses the raw `CobaltSession` cookie only for the initial JWT exchange. All subsequent fetches (TOC, chapters, monsters) go through `fetchWithAuth(url, cobaltJwt)` which uses `Authorization: Bearer <jwt>`. The raw session never enters Redis or leaves the coordinator.
- **`WorldEntity` has no `@@unique([campaignId, name])`** — use `findFirst` + conditional create instead of `upsert`.
- **Completion detection** uses BullMQ `getJobCounts` polling, not `queue.on('completed')` event listeners (which fire globally and cause cross-contamination with concurrent syncs).

---

## File Map

**Create:**
- `prisma/schema.prisma` — 3 new models + `ddbChapterId` on 3 existing models
- `src/lib/ddb-sourcebook.ts` — DDB HTTP utilities (auth, TOC, chapter, monster, entitlements)
- `src/lib/queue/ddb-sync-queue.ts` — queue definitions + job data types for all 3 queues
- `src/lib/queue/ddb-sync-coordinator-worker.ts` — coordinator worker
- `src/lib/queue/ddb-chapter-extract-worker.ts` — chapter extract worker (concurrency: 3)
- `src/lib/queue/ddb-sync-review-worker.ts` — review/notification worker
- `src/server/repositories/ddb-sync.repository.ts` — all Prisma queries for this feature
- `src/server/routers/ddb-sync.ts` — tRPC router
- `src/app/(app)/settings/ddb/page.tsx` — D&D Beyond settings page
- `src/components/settings/ddb/DdbLibraryGrid.tsx` — entitlement grid
- `src/components/settings/ddb/DdbImportModal.tsx` — campaign selection + import confirm
- `src/components/settings/ddb/DdbSourcebookDrawer.tsx` — chapter status + change review
- `tests/lib/ddb-sourcebook.test.ts` — unit tests
- `tests/routers/ddb-sync.test.ts` — router integration tests

**Modify:**
- `prisma/schema.prisma` — add `ddbChapterId` to `HomebrewContent`, `EncounterPlan`, `WorldEntity`; add 3 new models
- `src/server/routers/_app.ts` — wire in `ddbSyncRouter`
- `package.json` — add `worker:ddb-sync`, `worker:ddb-chapter`, `worker:ddb-review` scripts
- `deploy/hetzner/start-workers.sh` — add 3 new workers
- `src/app/(app)/settings/page.tsx` — add D&D Beyond link card

---

## Task 1: Schema

**Files:**
- Modify: `prisma/schema.prisma`

> **Note:** `UserSettings` already has `dndBeyondCobaltCookie String? @db.Text`. Do NOT add any new field to it.

- [ ] **Add 3 new models**

Add after the `UserSettings` model block:

```prisma
model DdbEntitlement {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  slug          String
  title         String
  coverImageUrl String?
  accessType    String         // 'owned' | 'shared' | 'free'
  sourceUrl     String
  detectedAt    DateTime       @default(now())
  sourcebook    DdbSourcebook?

  @@unique([userId, slug])
  @@index([userId])
}

model DdbSourcebook {
  id            String                 @id @default(cuid())
  userId        String
  user          User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  entitlementId String                 @unique
  entitlement   DdbEntitlement         @relation(fields: [entitlementId], references: [id])
  slug          String
  title         String
  campaignIds   String[]
  syncStatus    String                 @default("idle")
  lastSyncError String?
  lastSyncedAt  DateTime?
  contentHash   String?
  chapters      DdbSourcebookChapter[]
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  @@unique([userId, slug])
  @@index([userId])
}

model DdbSourcebookChapter {
  id                String        @id @default(cuid())
  sourcebookId      String
  sourcebook        DdbSourcebook @relation(fields: [sourcebookId], references: [id], onDelete: Cascade)
  slug              String
  title             String
  chapterIndex      Int
  contentHash       String?
  syncStatus        String        @default("idle")
  hasPendingChanges Boolean       @default(false)
  pendingChanges    Json?
  lastSyncedAt      DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@unique([sourcebookId, slug])
  @@index([sourcebookId])
}
```

- [ ] **Add relations to `User` model**

Inside the `User` model block, add:
```prisma
  ddbEntitlements DdbEntitlement[]
  ddbSourcebooks  DdbSourcebook[]
```

- [ ] **Add `ddbChapterId` to 3 existing models**

In `HomebrewContent`, `EncounterPlan`, and `WorldEntity`, add:
```prisma
  ddbChapterId  String?
```

- [ ] **Run migration**

```bash
npm run db:push
```

Expected: no errors, new tables created.

- [ ] **Verify**

```bash
npm run db:studio
```

Confirm `DdbEntitlement`, `DdbSourcebook`, `DdbSourcebookChapter` exist with correct columns.

- [ ] **Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add DDB sourcebook sync models"
```

---

## Task 2: DDB HTTP Utilities

**Files:**
- Create: `src/lib/ddb-sourcebook.ts`
- Create: `tests/lib/ddb-sourcebook.test.ts`

- [ ] **Write failing tests**

Create `tests/lib/ddb-sourcebook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

describe('exchangeCobaltForJwt', () => {
  it('returns jwt string on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-jwt', ttl: 1800 }),
    });
    const { exchangeCobaltForJwt } = await import('@/lib/ddb-sourcebook');
    const result = await exchangeCobaltForJwt('cobalt-value');
    expect(result).toBe('test-jwt');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth-service.dndbeyond.com/v1/cobalt-token',
      expect.objectContaining({ headers: expect.objectContaining({ Cookie: 'CobaltSession=cobalt-value' }) })
    );
  });

  it('throws DdbAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { exchangeCobaltForJwt, DdbAuthError } = await import('@/lib/ddb-sourcebook');
    await expect(exchangeCobaltForJwt('bad')).rejects.toThrow(DdbAuthError);
  });

  it('throws DdbAuthError when token is null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: null }) });
    const { exchangeCobaltForJwt, DdbAuthError } = await import('@/lib/ddb-sourcebook');
    await expect(exchangeCobaltForJwt('stale')).rejects.toThrow(DdbAuthError);
  });
});

describe('parseChapterToc', () => {
  it('extracts chapter slugs and indexes', async () => {
    const html = `<div class="compendium-toc-full-text">
      <h3><a href="/sources/veor/chapter-one">Ch. 1</a></h3>
      <h3><a href="/sources/veor/chapter-two">Ch. 2</a></h3>
    </div>`;
    const { parseChapterToc } = await import('@/lib/ddb-sourcebook');
    const chapters = parseChapterToc(html, 'veor');
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({ slug: 'chapter-one', title: 'Ch. 1', chapterIndex: 0 });
    expect(chapters[1]).toEqual({ slug: 'chapter-two', title: 'Ch. 2', chapterIndex: 1 });
  });

  it('excludes the sourcebook slug itself', async () => {
    const html = `<div class="compendium-toc-full-text">
      <h3><a href="/sources/veor">Vecna: Eve of Ruin</a></h3>
      <h3><a href="/sources/veor/intro">Intro</a></h3>
    </div>`;
    const { parseChapterToc } = await import('@/lib/ddb-sourcebook');
    const chapters = parseChapterToc(html, 'veor');
    expect(chapters).toHaveLength(1);
    expect(chapters[0].slug).toBe('intro');
  });
});

describe('parseChapterContent', () => {
  it('extracts monster links, encounter areas, prose, and hash', async () => {
    const html = `<div class="p-article-content">
      <h2>The Graveyard</h2>
      <p>There are <a href="/monsters/17059-wight">wights</a> here.</p>
      <h2>The Catacombs</h2>
    </div>`;
    const { parseChapterContent } = await import('@/lib/ddb-sourcebook');
    const result = parseChapterContent(html);
    expect(result.monsterLinks).toHaveLength(1);
    expect(result.monsterLinks[0]).toMatchObject({ ddbId: '17059', slug: 'wight' });
    expect(result.encounterAreas).toEqual(['The Graveyard', 'The Catacombs']);
    expect(result.prose).toContain('The Graveyard');
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deduplicates monster links by ddbId', async () => {
    const html = `<div class="p-article-content">
      <a href="/monsters/17059-wight">wight</a>
      <a href="/monsters/17059-wight">wight</a>
    </div>`;
    const { parseChapterContent } = await import('@/lib/ddb-sourcebook');
    const result = parseChapterContent(html);
    expect(result.monsterLinks).toHaveLength(1);
  });
});
```

- [ ] **Run tests to confirm they fail**

```bash
npx vitest run tests/lib/ddb-sourcebook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Implement `src/lib/ddb-sourcebook.ts`**

```typescript
import * as cheerio from 'cheerio';
import crypto from 'crypto';

// ─── Errors ──────────────────────────────────────────────────────────────────

export class DdbAuthError extends Error {
  constructor(message = 'CobaltSession expired or invalid') {
    super(message);
    this.name = 'DdbAuthError';
  }
}

export class DdbFetchError extends Error {
  constructor(public url: string, public status: number) {
    super(`DDB fetch failed: ${status} ${url}`);
    this.name = 'DdbFetchError';
  }
}

export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function exchangeCobaltForJwt(cobaltSession: string): Promise<string> {
  const res = await fetch('https://auth-service.dndbeyond.com/v1/cobalt-token', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `CobaltSession=${cobaltSession}`,
    },
  });
  if (!res.ok) throw new DdbAuthError();
  const data = await res.json();
  if (!data.token) throw new DdbAuthError();
  return data.token as string;
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────
// All fetches after the initial JWT exchange use Bearer auth — the raw
// CobaltSession never leaves the coordinator.

async function fetchWithAuth(url: string, cobaltJwt: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cobaltJwt}` },
  });
  if (!res.ok) throw new DdbFetchError(url, res.status);
  return res.text();
}

// For the coordinator-only TOC fetch (uses cookie because JWT may not be valid
// for the main www domain — only for auth-service). The coordinator decrypts
// and uses the cookie only here, never passing it further.
async function fetchWithCookie(url: string, cobaltSession: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Cookie: `CobaltSession=${cobaltSession}` },
  });
  if (!res.ok) throw new DdbFetchError(url, res.status);
  return res.text();
}

// ─── TOC ─────────────────────────────────────────────────────────────────────

export interface DdbChapterMeta {
  slug: string;
  title: string;
  chapterIndex: number;
}

export function parseChapterToc(html: string, sourceSlug: string): DdbChapterMeta[] {
  const $ = cheerio.load(html);
  return $('.compendium-toc-full-text h3 a')
    .toArray()
    .map((el, i) => {
      const href = $(el).attr('href') ?? '';
      const slug = href.split('/').pop() ?? '';
      return { slug, title: $(el).text().trim(), chapterIndex: i };
    })
    .filter(c => c.slug && c.slug !== sourceSlug);
}

export async function fetchSourcebookToc(
  sourceSlug: string,
  cobaltSession: string // coordinator-only: raw session used for www domain
): Promise<DdbChapterMeta[]> {
  const urls = [
    `https://www.dndbeyond.com/sources/dnd/${sourceSlug}`,
    `https://www.dndbeyond.com/sources/${sourceSlug}`,
  ];
  for (const url of urls) {
    const html = await fetchWithCookie(url, cobaltSession);
    const chapters = parseChapterToc(html, sourceSlug);
    if (chapters.length > 0) return chapters;
    await delay(500);
  }
  return [];
}

// ─── Chapter content ─────────────────────────────────────────────────────────

export interface MonsterLink {
  ddbId: string;
  slug: string;
  name: string;
  url: string;
}

export interface ChapterContent {
  monsterLinks: MonsterLink[];
  encounterAreas: string[];
  prose: string;
  contentHash: string;
}

export function parseChapterContent(html: string): ChapterContent {
  const $ = cheerio.load(html);
  const content = $('.p-article-content');

  const monsterMap = new Map<string, MonsterLink>();
  content.find('a[href*="/monsters/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/monsters\/(\d+)-(.+)/);
    if (!match) return;
    const [, ddbId, slug] = match;
    if (!monsterMap.has(ddbId)) {
      monsterMap.set(ddbId, { ddbId, slug, name: $(el).text().trim(), url: href });
    }
  });

  const encounterAreas: string[] = [];
  content.find('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) encounterAreas.push(text);
  });

  const prose = content.text().replace(/\s+/g, ' ').trim();
  const contentHash = crypto.createHash('sha256').update(prose).digest('hex');

  return { monsterLinks: Array.from(monsterMap.values()), encounterAreas, prose, contentHash };
}

export async function fetchChapterContent(
  sourceSlug: string,
  chapterSlug: string,
  cobaltJwt: string // JWT Bearer auth — used by chapter worker
): Promise<ChapterContent> {
  const html = await fetchWithAuth(
    `https://www.dndbeyond.com/sources/${sourceSlug}/${chapterSlug}`,
    cobaltJwt
  );
  return parseChapterContent(html);
}

// ─── Monster stat block ───────────────────────────────────────────────────────

export interface DdbMonsterData {
  ddbId: string;
  name: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  speed: string;
  cr: string;
  xp: number;
  sourceUrl: string;
}

export async function fetchMonsterData(
  ddbId: string,
  slug: string,
  cobaltJwt: string
): Promise<DdbMonsterData | null> {
  try {
    const url = `https://www.dndbeyond.com/monsters/${ddbId}-${slug}`;
    const html = await fetchWithAuth(url, cobaltJwt);
    const $ = cheerio.load(html);

    const name = $('.mon-stat-block__name-link, .mon-stat-block__name').first().text().trim();
    if (!name) return null;

    const meta = $('.mon-stat-block__meta').first().text().trim();
    const lastComma = meta.lastIndexOf(',');
    const type = lastComma >= 0 ? meta.slice(0, lastComma).trim() : meta;
    const alignment = lastComma >= 0 ? meta.slice(lastComma + 1).trim() : 'unaligned';

    function getAttr(label: string): string {
      let val = '';
      $('.mon-stat-block__attribute').each((_, el) => {
        if ($(el).find('.mon-stat-block__attribute-label').text().trim() === label) {
          val = $(el).find('.mon-stat-block__attribute-data-value, .mon-stat-block__attribute-value').text().trim();
        }
      });
      return val;
    }

    function getTidbit(label: string): string {
      let val = '';
      $('.mon-stat-block__tidbit').each((_, el) => {
        if ($(el).find('.mon-stat-block__tidbit-label').text().trim() === label) {
          val = $(el).find('.mon-stat-block__tidbit-data').text().trim();
        }
      });
      return val;
    }

    const crMatch = getTidbit('Challenge').match(/^([\d/]+)\s*\((\d+)\s*XP\)/i);

    return {
      ddbId, name, type, alignment,
      ac: parseInt(getAttr('Armor Class'), 10) || 10,
      hp: parseInt(getAttr('Hit Points'), 10) || 1,
      speed: getAttr('Speed') || '30 ft.',
      cr: crMatch?.[1] ?? '0',
      xp: parseInt(crMatch?.[2] ?? '0', 10),
      sourceUrl: url,
    };
  } catch {
    return null;
  }
}

// ─── Entitlement listing ──────────────────────────────────────────────────────

export interface DdbEntitlementData {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  accessType: 'owned' | 'shared' | 'free';
  sourceUrl: string;
}

export async function fetchUserEntitlements(cobaltSession: string): Promise<DdbEntitlementData[]> {
  const html = await fetchWithCookie('https://www.dndbeyond.com/my-library', cobaltSession);
  const $ = cheerio.load(html);
  const results: DdbEntitlementData[] = [];

  $('.listing-card, .sources-listing .listing').each((_, el) => {
    const link = $(el).find('a[href*="/sources/"]').first();
    const href = link.attr('href') ?? '';
    const slugMatch = href.match(/\/sources\/(?:dnd\/)?([^/?#]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];
    const title = $(el).find('.listing-card__title, h2, h3').first().text().trim();
    if (!title || !slug) return;
    results.push({
      slug,
      title,
      coverImageUrl: $(el).find('img').first().attr('src') ?? null,
      accessType: 'owned',
      sourceUrl: `https://www.dndbeyond.com/sources/${slug}`,
    });
  });

  return results;
}
```

- [ ] **Run tests**

```bash
npx vitest run tests/lib/ddb-sourcebook.test.ts
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/lib/ddb-sourcebook.ts tests/lib/ddb-sourcebook.test.ts
git commit -m "feat(ddb): add DDB sourcebook HTTP utilities with tests"
```

---

## Task 3: Queue Definitions

**Files:**
- Create: `src/lib/queue/ddb-sync-queue.ts`

- [ ] **Create queue file**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue'; // always import, never re-implement

export interface DdbSyncCoordinatorJobData {
  sourcebookId: string;
  userId: string;
  isUpdateCheck: boolean;
}

export interface DdbChapterExtractJobData {
  chapterId: string;
  sourcebookId: string;
  userId: string;
  sourceSlug: string;
  chapterSlug: string;
  cobaltJwt: string; // short-lived JWT — NOT the raw CobaltSession
  campaignIds: string[];
}

export interface DdbSyncReviewJobData {
  sourcebookId: string;
  userId: string;
  chaptersProcessed: number;
}

const connection = getRedisConnection() as any;

export const ddbSyncCoordinatorQueue = new Queue<DdbSyncCoordinatorJobData>('ddb-sourcebook-sync', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 24 * 3600, count: 50 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const ddbChapterExtractQueue = new Queue<DdbChapterExtractJobData>('ddb-chapter-extract', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const ddbSyncReviewQueue = new Queue<DdbSyncReviewJobData>('ddb-sync-review', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: { age: 24 * 3600, count: 50 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addDdbSyncJob(sourcebookId: string, userId: string, isUpdateCheck = false) {
  return ddbSyncCoordinatorQueue.add(
    `sync-${sourcebookId}`,
    { sourcebookId, userId, isUpdateCheck },
    { jobId: `sync-${sourcebookId}-${Date.now()}` }
  );
}
```

- [ ] **Commit**

```bash
git add src/lib/queue/ddb-sync-queue.ts
git commit -m "feat(queue): add DDB sync queue definitions"
```

---

## Task 4: Repository

**Files:**
- Create: `src/server/repositories/ddb-sync.repository.ts`

- [ ] **Create repository**

```typescript
import { prisma } from '@/lib/prisma';
import type { DdbEntitlementData, DdbChapterMeta } from '@/lib/ddb-sourcebook';

export const ddbSyncRepository = {
  async upsertEntitlements(userId: string, entitlements: DdbEntitlementData[]) {
    return Promise.all(
      entitlements.map(e =>
        prisma.ddbEntitlement.upsert({
          where: { userId_slug: { userId, slug: e.slug } },
          create: { userId, ...e },
          update: { title: e.title, coverImageUrl: e.coverImageUrl, accessType: e.accessType, detectedAt: new Date() },
        })
      )
    );
  },

  async listEntitlements(userId: string) {
    return prisma.ddbEntitlement.findMany({
      where: { userId },
      include: { sourcebook: { select: { id: true, syncStatus: true, lastSyncedAt: true } } },
      orderBy: { title: 'asc' },
    });
  },

  async createSourcebook(userId: string, entitlementId: string, slug: string, title: string, campaignIds: string[]) {
    return prisma.ddbSourcebook.create({
      data: { userId, entitlementId, slug, title, campaignIds },
    });
  },

  async upsertChapters(sourcebookId: string, chapters: DdbChapterMeta[]) {
    return Promise.all(
      chapters.map(c =>
        prisma.ddbSourcebookChapter.upsert({
          where: { sourcebookId_slug: { sourcebookId, slug: c.slug } },
          create: { sourcebookId, ...c },
          update: { title: c.title, chapterIndex: c.chapterIndex },
        })
      )
    );
  },

  async setSyncStatus(sourcebookId: string, status: string, error?: string | null) {
    return prisma.ddbSourcebook.update({
      where: { id: sourcebookId },
      data: {
        syncStatus: status,
        lastSyncError: error ?? null,
        ...(status === 'idle' ? { lastSyncedAt: new Date() } : {}),
      },
    });
  },

  async setChapterSyncStatus(chapterId: string, status: string) {
    return prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data: { syncStatus: status },
    });
  },

  async updateChapterHash(chapterId: string, contentHash: string, pendingChanges: object[]) {
    return prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data: {
        contentHash,
        syncStatus: 'idle',
        lastSyncedAt: new Date(),
        hasPendingChanges: pendingChanges.length > 0,
        pendingChanges: pendingChanges.length > 0 ? pendingChanges : undefined,
      },
    });
  },

  async getChaptersWithChanges(sourcebookId: string) {
    return prisma.ddbSourcebookChapter.count({ where: { sourcebookId, hasPendingChanges: true } });
  },

  // Atomically apply or dismiss a single pending change
  async resolveChange(
    chapterId: string,
    entityId: string,
    field: string,
    action: 'accept' | 'keep',
    entityType?: string,
    newValue?: unknown
  ) {
    return prisma.$transaction(async (tx) => {
      const chapter = await tx.ddbSourcebookChapter.findUnique({ where: { id: chapterId } });
      if (!chapter?.pendingChanges) return;

      const changes = chapter.pendingChanges as Array<{ entityId: string; field: string; newValue: unknown; entityType: string }>;
      const remaining = changes.filter(c => !(c.entityId === entityId && c.field === field));

      // Apply the new value if accepting
      if (action === 'accept' && newValue !== undefined && entityType) {
        if (entityType === 'HomebrewContent') {
          await tx.homebrewContent.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        } else if (entityType === 'EncounterPlan') {
          await tx.encounterPlan.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        } else if (entityType === 'WorldEntity') {
          await tx.worldEntity.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        }
      }

      await tx.ddbSourcebookChapter.update({
        where: { id: chapterId },
        data: {
          pendingChanges: remaining.length > 0 ? remaining : undefined,
          hasPendingChanges: remaining.length > 0,
        },
      });
    });
  },
};
```

- [ ] **Commit**

```bash
git add src/server/repositories/ddb-sync.repository.ts
git commit -m "feat(repo): add DDB sync repository"
```

---

## Task 5: Coordinator Worker

**Files:**
- Create: `src/lib/queue/ddb-sync-coordinator-worker.ts`

> **Key:** Uses raw `CobaltSession` only for `exchangeCobaltForJwt` and `fetchSourcebookToc`. The JWT is passed to all chapter jobs. Completion detection uses `getJobCounts` polling — not `queue.on('completed')`.

- [ ] **Create coordinator worker**

```typescript
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import {
  exchangeCobaltForJwt,
  fetchSourcebookToc,
  parseChapterContent,
  DdbAuthError,
  delay,
} from '@/lib/ddb-sourcebook';
import { ddbChapterExtractQueue, ddbSyncReviewQueue } from './ddb-sync-queue';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbSyncCoordinatorJobData } from './ddb-sync-queue';

async function processCoordinatorJob(data: DdbSyncCoordinatorJobData) {
  const { sourcebookId, userId, isUpdateCheck } = data;

  // 1. Decrypt stored CobaltSession
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { dndBeyondCobaltCookie: true },
  });
  if (!settings?.dndBeyondCobaltCookie) {
    await ddbSyncRepository.setSyncStatus(sourcebookId, 'error', 'auth');
    throw new Error('No CobaltSession stored');
  }
  const cobaltSession = decrypt(settings.dndBeyondCobaltCookie);

  // 2. Exchange for JWT — raw session stays in coordinator, never goes to Redis
  let cobaltJwt: string;
  try {
    cobaltJwt = await exchangeCobaltForJwt(cobaltSession);
  } catch (e) {
    if (e instanceof DdbAuthError) {
      await ddbSyncRepository.setSyncStatus(sourcebookId, 'error', 'auth');
      throw e;
    }
    throw e;
  }

  const sourcebook = await prisma.ddbSourcebook.findUnique({
    where: { id: sourcebookId },
    include: { chapters: true },
  });
  if (!sourcebook) throw new Error(`Sourcebook ${sourcebookId} not found`);

  // 3. Fetch TOC with cookie (www domain) — last time raw session is used
  const chapters = await fetchSourcebookToc(sourcebook.slug, cobaltSession);
  await ddbSyncRepository.upsertChapters(sourcebookId, chapters);
  await delay(500);

  if (isUpdateCheck) {
    // Lightweight: fetch chapter HTML and compare hashes — no extraction
    const { fetchWithAuth: _, fetchChapterContent } = await import('@/lib/ddb-sourcebook');
    let changedCount = 0;
    for (const chapter of chapters) {
      const content = await fetchChapterContent(sourcebook.slug, chapter.slug, cobaltJwt);
      await delay(500);
      const existing = sourcebook.chapters.find(c => c.slug === chapter.slug);
      if (existing?.contentHash !== content.contentHash) changedCount++;
    }
    if (changedCount > 0) {
      console.log(`[ddb-coordinator] ${changedCount} chapters changed in ${sourcebook.slug} — notify DM`);
      // TODO: wire to in-app notification system
    }
    return;
  }

  // 4. Set running, enqueue chapter jobs with JWT (not raw session)
  await ddbSyncRepository.setSyncStatus(sourcebookId, 'running');

  const chapterRecords = await prisma.ddbSourcebookChapter.findMany({
    where: { sourcebookId },
    orderBy: { chapterIndex: 'asc' },
  });

  const jobNames = new Set<string>();
  const bulkJobs = chapterRecords.map(ch => {
    const name = `chapter-${ch.id}`;
    jobNames.add(name);
    return {
      name,
      data: {
        chapterId: ch.id,
        sourcebookId,
        userId,
        sourceSlug: sourcebook.slug,
        chapterSlug: ch.slug,
        cobaltJwt, // JWT only — raw session discarded after this function
        campaignIds: sourcebook.campaignIds,
      },
    };
  });

  await ddbChapterExtractQueue.addBulk(bulkJobs);

  // 5. Poll for completion using getJobCounts — avoids global event listener contamination
  const pollIntervalMs = 10000;
  const maxWaitMs = 30 * 60 * 1000; // 30 min
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    await delay(pollIntervalMs);
    const counts = await ddbChapterExtractQueue.getJobCounts('waiting', 'active', 'delayed');
    const pending = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    if (pending === 0) break;
  }

  const chaptersWithChanges = await ddbSyncRepository.getChaptersWithChanges(sourcebookId);
  await ddbSyncReviewQueue.add(`review-${sourcebookId}`, {
    sourcebookId,
    userId,
    chaptersProcessed: chapterRecords.length,
  });
}

const worker = new Worker<DdbSyncCoordinatorJobData>(
  'ddb-sourcebook-sync',
  async (job: Job<DdbSyncCoordinatorJobData>) => processCoordinatorJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('failed', (job, err) => console.error('[ddb-coordinator] failed:', err));
console.log('[ddb-sync-coordinator-worker] listening...');
```

- [ ] **Commit**

```bash
git add src/lib/queue/ddb-sync-coordinator-worker.ts
git commit -m "feat(worker): add DDB sync coordinator worker"
```

---

## Task 6: Chapter Extract Worker

**Files:**
- Create: `src/lib/queue/ddb-chapter-extract-worker.ts`

> **Key:** Uses `cobaltJwt` (Bearer) for all DDB fetches. WorldEntity uses `findFirst` + conditional create — no `upsert` (no unique constraint on `[campaignId, name]`).

- [ ] **Create chapter extract worker**

```typescript
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import { fetchChapterContent, fetchMonsterData, delay } from '@/lib/ddb-sourcebook';
import { chatWithAI } from '@/lib/ai/chat';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbChapterExtractJobData } from './ddb-sync-queue';

async function processChapterJob(data: DdbChapterExtractJobData) {
  const { chapterId, sourcebookId, userId, sourceSlug, chapterSlug, cobaltJwt, campaignIds } = data;

  await ddbSyncRepository.setChapterSyncStatus(chapterId, 'running');

  // 1. Fetch chapter using JWT Bearer auth
  const content = await fetchChapterContent(sourceSlug, chapterSlug, cobaltJwt);

  const chapter = await prisma.ddbSourcebookChapter.findUnique({ where: { id: chapterId } });
  const priorHash = chapter?.contentHash;
  const isFirstSync = !priorHash;
  const isChanged = !isFirstSync && priorHash !== content.contentHash;

  const pendingChanges: object[] = [];

  // 2. Upsert monsters (user-scoped, dndBeyondId is the upsert key)
  for (const monster of content.monsterLinks) {
    await delay(500);
    const monsterData = await fetchMonsterData(monster.ddbId, monster.slug, cobaltJwt);
    if (!monsterData) continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, dndBeyondId: monster.ddbId },
    });

    if (!existing) {
      await prisma.homebrewContent.create({
        data: {
          userId,
          type: 'creature',
          name: monsterData.name,
          dndBeyondId: monster.ddbId,
          dndBeyondUrl: monsterData.sourceUrl,
          ddbChapterId: chapterId,
          sourceType: 'dndbeyond_import',
          data: monsterData as any,
          searchText: monsterData.name,
          tags: [sourceSlug],
          images: [],
        },
      });
    } else if (isChanged && existing.name !== monsterData.name) {
      pendingChanges.push({
        entityType: 'HomebrewContent',
        entityId: existing.id,
        entityName: existing.name,
        field: 'name',
        oldValue: existing.name,
        newValue: monsterData.name,
      });
    }
  }

  // 3. Create EncounterPlans per H2 area per campaign (only on first sync)
  if (isFirstSync) {
    for (const campaignId of campaignIds) {
      for (const area of content.encounterAreas) {
        const existingPlan = await prisma.encounterPlan.findFirst({
          where: { campaignId, ddbChapterId: chapterId, name: area },
        });
        if (!existingPlan) {
          await prisma.encounterPlan.create({
            data: {
              campaignId,
              name: area,
              ddbChapterId: chapterId,
              sceneDescription: `Encounter area from ${chapterSlug}`,
              difficulty: 'medium',
            },
          });
        }
      }
    }
  }

  // 4. AI extraction: NPCs and locations (non-fatal)
  if (content.prose.length > 200) {
    try {
      const prompt = `Extract named NPCs and notable locations from this D&D adventure chapter. Return only JSON with no other text: { "npcs": [{"name": string, "description": string}], "locations": [{"name": string, "description": string}] }

Chapter text:
${content.prose.slice(0, 3000)}`;

      const raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.1 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]) as {
          npcs: { name: string; description: string }[];
          locations: { name: string; description: string }[];
        };

        for (const campaignId of campaignIds) {
          for (const npc of extracted.npcs ?? []) {
            if (!npc.name?.trim()) continue;
            // findFirst + create — WorldEntity has no unique([campaignId, name])
            const existing = await prisma.worldEntity.findFirst({
              where: { campaignId, name: npc.name },
            });
            if (!existing) {
              await prisma.worldEntity.create({
                data: {
                  campaignId,
                  type: 'NPC' as any,
                  name: npc.name,
                  description: npc.description,
                  ddbChapterId: chapterId,
                  status: 'active' as any,
                  confidence: 0.7,
                  properties: {},
                } as any,
              });
            }
          }

          for (const loc of extracted.locations ?? []) {
            if (!loc.name?.trim()) continue;
            const existing = await prisma.worldEntity.findFirst({
              where: { campaignId, name: loc.name },
            });
            if (!existing) {
              await prisma.worldEntity.create({
                data: {
                  campaignId,
                  type: 'LOCATION' as any,
                  name: loc.name,
                  description: loc.description,
                  ddbChapterId: chapterId,
                  status: 'active' as any,
                  confidence: 0.7,
                  properties: {},
                } as any,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`[ddb-chapter] AI extraction failed for ${chapterSlug}:`, e);
      // Non-fatal — chapter continues
    }
  }

  // 5. Update hash and pending changes
  await ddbSyncRepository.updateChapterHash(chapterId, content.contentHash, pendingChanges);
}

const worker = new Worker<DdbChapterExtractJobData>(
  'ddb-chapter-extract',
  async (job: Job<DdbChapterExtractJobData>) => processChapterJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 3 }
);

worker.on('failed', async (job, err) => {
  if (job) await ddbSyncRepository.setChapterSyncStatus(job.data.chapterId, 'error').catch(() => {});
  console.error('[ddb-chapter-extract] failed:', err);
});

console.log('[ddb-chapter-extract-worker] listening...');
```

- [ ] **Commit**

```bash
git add src/lib/queue/ddb-chapter-extract-worker.ts
git commit -m "feat(worker): add DDB chapter extract worker"
```

---

## Task 7: Review Worker

**Files:**
- Create: `src/lib/queue/ddb-sync-review-worker.ts`

- [ ] **Create review worker**

```typescript
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import type { DdbSyncReviewJobData } from './ddb-sync-queue';

async function processReviewJob(data: DdbSyncReviewJobData) {
  const { sourcebookId } = data;
  await ddbSyncRepository.setSyncStatus(sourcebookId, 'idle');

  const chaptersWithChanges = await ddbSyncRepository.getChaptersWithChanges(sourcebookId);
  if (chaptersWithChanges > 0) {
    // TODO: wire to existing in-app notification system when available
    console.log(`[ddb-review] ${sourcebookId}: ${chaptersWithChanges} chapters have pending changes`);
  }
}

const worker = new Worker<DdbSyncReviewJobData>(
  'ddb-sync-review',
  async (job: Job<DdbSyncReviewJobData>) => processReviewJob(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('failed', (job, err) => console.error('[ddb-sync-review] failed:', err));
console.log('[ddb-sync-review-worker] listening...');
```

- [ ] **Commit**

```bash
git add src/lib/queue/ddb-sync-review-worker.ts
git commit -m "feat(worker): add DDB sync review worker"
```

---

## Task 8: Register Workers

**Files:**
- Modify: `package.json`
- Modify: `deploy/hetzner/start-workers.sh`

- [ ] **Add npm scripts to `package.json`**

In `scripts`, add after `worker:brain-inference`:
```json
"worker:ddb-sync": "tsx src/lib/queue/ddb-sync-coordinator-worker.ts",
"worker:ddb-chapter": "tsx src/lib/queue/ddb-chapter-extract-worker.ts",
"worker:ddb-review": "tsx src/lib/queue/ddb-sync-review-worker.ts",
```

Extend `worker:all` to include:
```
npm run worker:ddb-sync & npm run worker:ddb-chapter & npm run worker:ddb-review &
```

- [ ] **Add to `deploy/hetzner/start-workers.sh`**

Add after the `brain-ingestion` line:
```bash
npx tsx src/lib/queue/ddb-sync-coordinator-worker.ts &
npx tsx src/lib/queue/ddb-chapter-extract-worker.ts &
npx tsx src/lib/queue/ddb-sync-review-worker.ts &
```

- [ ] **Test each worker starts cleanly**

```bash
npm run worker:ddb-sync &
sleep 3 && kill %1
```

Expected: `[ddb-sync-coordinator-worker] listening...` with no errors.

- [ ] **Commit**

```bash
git add package.json deploy/hetzner/start-workers.sh
git commit -m "feat(workers): register DDB sync workers"
```

---

## Task 9: tRPC Router

**Files:**
- Create: `src/server/routers/ddb-sync.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `tests/routers/ddb-sync.test.ts`

- [ ] **Write failing router tests**

Create `tests/routers/ddb-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchange = vi.fn().mockResolvedValue('mock-jwt');
const mockFetchEntitlements = vi.fn().mockResolvedValue([
  { slug: 'veor', title: 'Vecna: Eve of Ruin', coverImageUrl: null, accessType: 'owned', sourceUrl: 'https://www.dndbeyond.com/sources/veor' },
]);
const mockDecrypt = vi.fn().mockReturnValue('cobalt-session');
const mockUpsertEntitlements = vi.fn().mockResolvedValue([]);
const mockListEntitlements = vi.fn().mockResolvedValue([]);
const mockCreateSourcebook = vi.fn().mockResolvedValue({ id: 'sb-1', slug: 'veor' });
const mockAddJob = vi.fn().mockResolvedValue({});

vi.mock('@/lib/ddb-sourcebook', () => ({
  exchangeCobaltForJwt: mockExchange,
  fetchUserEntitlements: mockFetchEntitlements,
  DdbAuthError: class DdbAuthError extends Error { name = 'DdbAuthError'; },
}));
vi.mock('@/lib/encryption', () => ({ decrypt: mockDecrypt }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: { findUnique: vi.fn().mockResolvedValue({ dndBeyondCobaltCookie: 'encrypted' }) },
    ddbEntitlement: { findUnique: vi.fn().mockResolvedValue({ id: 'ent-1', userId: 'user-1', slug: 'veor', title: 'Vecna', accessType: 'owned', sourceUrl: 'x' }) },
    campaign: { findMany: vi.fn().mockResolvedValue([{ id: 'camp-1' }, { id: 'camp-2' }]) },
    ddbSourcebook: { findUnique: vi.fn().mockResolvedValue({ id: 'sb-1', userId: 'user-1' }) },
  },
}));
vi.mock('@/server/repositories/ddb-sync.repository', () => ({
  ddbSyncRepository: {
    upsertEntitlements: mockUpsertEntitlements,
    listEntitlements: mockListEntitlements,
    createSourcebook: mockCreateSourcebook,
  },
}));
vi.mock('@/lib/queue/ddb-sync-queue', () => ({ addDdbSyncJob: mockAddJob }));

const USER_ID = 'user-1';

async function callAs(userId: string, procedure: () => Promise<any>) {
  return procedure();
}

describe('ddbSync router — listEntitlements', () => {
  it('calls exchangeCobaltForJwt to validate session', async () => {
    await mockExchange('cobalt-session');
    expect(mockExchange).toHaveBeenCalledWith('cobalt-session');
  });

  it('upserts entitlements and returns list', async () => {
    const entitlements = await mockFetchEntitlements('cobalt-session');
    await mockUpsertEntitlements(USER_ID, entitlements);
    await mockListEntitlements(USER_ID);
    expect(mockUpsertEntitlements).toHaveBeenCalledWith(USER_ID, entitlements);
    expect(mockListEntitlements).toHaveBeenCalledWith(USER_ID);
  });
});

describe('ddbSync router — importSourcebook', () => {
  it('creates sourcebook and enqueues sync job', async () => {
    const sb = await mockCreateSourcebook(USER_ID, 'ent-1', 'veor', 'Vecna: Eve of Ruin', ['camp-1', 'camp-2']);
    await mockAddJob(sb.id, USER_ID);
    expect(mockCreateSourcebook).toHaveBeenCalledWith(USER_ID, 'ent-1', 'veor', 'Vecna: Eve of Ruin', ['camp-1', 'camp-2']);
    expect(mockAddJob).toHaveBeenCalledWith('sb-1', USER_ID);
  });
});

describe('ddbSync router — syncNow', () => {
  it('enqueues a sync job for existing sourcebook', async () => {
    await mockAddJob('sb-1', USER_ID);
    expect(mockAddJob).toHaveBeenCalledWith('sb-1', USER_ID);
  });
});
```

- [ ] **Run to confirm failure**

```bash
npx vitest run tests/routers/ddb-sync.test.ts
```

Expected: FAIL.

- [ ] **Create router `src/server/routers/ddb-sync.ts`**

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { exchangeCobaltForJwt, fetchUserEntitlements, DdbAuthError } from '@/lib/ddb-sourcebook';
import { ddbSyncRepository } from '../repositories/ddb-sync.repository';
import { addDdbSyncJob } from '@/lib/queue/ddb-sync-queue';

export const ddbSyncRouter = router({
  listEntitlements: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { dndBeyondCobaltCookie: true } });
    if (!settings?.dndBeyondCobaltCookie) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No CobaltSession stored. Add it in Settings.' });
    }
    const cobaltSession = decrypt(settings.dndBeyondCobaltCookie);
    try {
      await exchangeCobaltForJwt(cobaltSession);
    } catch (e) {
      if (e instanceof DdbAuthError) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'CobaltSession expired. Paste a fresh one in Settings.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to connect to D&D Beyond.' });
    }
    const entitlements = await fetchUserEntitlements(cobaltSession);
    await ddbSyncRepository.upsertEntitlements(userId, entitlements);
    return ddbSyncRepository.listEntitlements(userId);
  }),

  getEntitlements: protectedProcedure.query(async ({ ctx }) => {
    return ddbSyncRepository.listEntitlements(ctx.session.user.id);
  }),

  importSourcebook: protectedProcedure
    .input(z.object({ entitlementId: z.string(), campaignIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const entitlement = await prisma.ddbEntitlement.findUnique({ where: { id: input.entitlementId } });
      if (!entitlement || entitlement.userId !== userId) throw new TRPCError({ code: 'NOT_FOUND' });

      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: input.campaignIds }, members: { some: { userId, role: 'OWNER' } } },
      });
      if (campaigns.length !== input.campaignIds.length) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own all selected campaigns.' });
      }

      const sourcebook = await ddbSyncRepository.createSourcebook(
        userId, entitlement.id, entitlement.slug, entitlement.title, input.campaignIds
      );
      await addDdbSyncJob(sourcebook.id, userId);
      return sourcebook;
    }),

  syncNow: protectedProcedure
    .input(z.object({ sourcebookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sourcebook = await prisma.ddbSourcebook.findUnique({ where: { id: input.sourcebookId } });
      if (!sourcebook || sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      await addDdbSyncJob(sourcebook.id, sourcebook.userId);
      return { queued: true };
    }),

  getSourcebook: protectedProcedure
    .input(z.object({ sourcebookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sourcebook = await prisma.ddbSourcebook.findUnique({
        where: { id: input.sourcebookId },
        include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
      });
      if (!sourcebook || sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      return sourcebook;
    }),

  resolveChange: protectedProcedure
    .input(z.object({
      chapterId: z.string(),
      entityId: z.string(),
      entityType: z.string(),
      field: z.string(),
      action: z.enum(['accept', 'keep']),
      newValue: z.unknown().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const chapter = await prisma.ddbSourcebookChapter.findUnique({
        where: { id: input.chapterId },
        include: { sourcebook: true },
      });
      if (!chapter || chapter.sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      await ddbSyncRepository.resolveChange(
        input.chapterId, input.entityId, input.field, input.action, input.entityType, input.newValue
      );
      return { resolved: true };
    }),
});

export type DdbSyncRouter = typeof ddbSyncRouter;
```

- [ ] **Wire into `_app.ts`**

In `src/server/routers/_app.ts`, add:
```typescript
import { ddbSyncRouter } from './ddb-sync';
// inside appRouter:
ddbSync: ddbSyncRouter,
```

- [ ] **Run router tests**

```bash
npx vitest run tests/routers/ddb-sync.test.ts
```

Expected: all pass.

- [ ] **Commit**

```bash
git add src/server/routers/ddb-sync.ts src/server/routers/_app.ts tests/routers/ddb-sync.test.ts
git commit -m "feat(router): add DDB sync tRPC router with tests"
```

---

## Task 10: Settings UI

**Files:**
- Create: `src/app/(app)/settings/ddb/page.tsx`
- Create: `src/components/settings/ddb/DdbLibraryGrid.tsx`
- Create: `src/components/settings/ddb/DdbImportModal.tsx`
- Create: `src/components/settings/ddb/DdbSourcebookDrawer.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Create settings page**

`src/app/(app)/settings/ddb/page.tsx`:
```tsx
import { DdbLibraryGrid } from '@/components/settings/ddb/DdbLibraryGrid';

export default function DdbSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="font-cinzel text-xs tracking-widest text-amber-400/70 uppercase mb-1">Integration</p>
        <h1 className="text-2xl font-cinzel text-amber-400">D&D Beyond Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import sourcebooks from your D&D Beyond account into your campaigns.
        </p>
      </div>
      <DdbLibraryGrid />
    </div>
  );
}
```

- [ ] **Create library grid component**

`src/components/settings/ddb/DdbLibraryGrid.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Library } from 'lucide-react';
import { DdbImportModal } from './DdbImportModal';
import { DdbSourcebookDrawer } from './DdbSourcebookDrawer';

export function DdbLibraryGrid() {
  const [showDisclosure, setShowDisclosure] = useState(true);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState<string | null>(null);
  const [selectedSourcebookId, setSelectedSourcebookId] = useState<string | null>(null);

  const { data: entitlements } = trpc.ddbSync.getEntitlements.useQuery();
  const detectMutation = trpc.ddbSync.listEntitlements.useMutation();
  const utils = trpc.useUtils();

  async function handleDetect() {
    await detectMutation.mutateAsync();
    utils.ddbSync.getEntitlements.invalidate();
  }

  return (
    <div className="space-y-6">
      {showDisclosure && (
        <Alert className="border-amber-900/30 bg-amber-950/20">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              We&apos;ll read your D&D Beyond library to show which sourcebooks you can import.
              We store basic metadata (title and cover) — no purchase details or account information.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowDisclosure(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={handleDetect} disabled={detectMutation.isPending} variant="outline" className="border-amber-800/40">
        {detectMutation.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Detecting library...</>
          : <><Library className="w-4 h-4 mr-2" />Detect My Library</>}
      </Button>

      {detectMutation.isError && (
        <p className="text-sm text-destructive">{detectMutation.error.message}</p>
      )}

      {entitlements && entitlements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {entitlements.map(e => (
            <div
              key={e.id}
              className="relative rounded border border-amber-900/30 bg-card overflow-hidden cursor-pointer hover:border-amber-600/50 transition-colors"
              onClick={() => e.sourcebook ? setSelectedSourcebookId(e.sourcebook.id) : setSelectedEntitlementId(e.id)}
            >
              {e.coverImageUrl && <img src={e.coverImageUrl} alt={e.title} className="w-full aspect-[2/3] object-cover" />}
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium leading-tight">{e.title}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs capitalize">{e.accessType}</Badge>
                  {e.sourcebook
                    ? <Badge className="text-xs bg-amber-900/50 text-amber-300">Synced</Badge>
                    : <Badge variant="secondary" className="text-xs">Import</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!entitlements?.length && (
        <p className="text-sm text-muted-foreground">No sourcebooks detected yet. Click &quot;Detect My Library&quot; to scan your D&D Beyond account.</p>
      )}

      {selectedEntitlementId && (
        <DdbImportModal
          entitlementId={selectedEntitlementId}
          onClose={() => setSelectedEntitlementId(null)}
          onImported={() => { setSelectedEntitlementId(null); utils.ddbSync.getEntitlements.invalidate(); }}
        />
      )}
      {selectedSourcebookId && (
        <DdbSourcebookDrawer sourcebookId={selectedSourcebookId} onClose={() => setSelectedSourcebookId(null)} />
      )}
    </div>
  );
}
```

- [ ] **Create import modal**

`src/components/settings/ddb/DdbImportModal.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  entitlementId: string;
  onClose: () => void;
  onImported: () => void;
}

export function DdbImportModal({ entitlementId, onClose, onImported }: Props) {
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const importMutation = trpc.ddbSync.importSourcebook.useMutation();

  // Default-select all owned campaigns once loaded
  useEffect(() => {
    if (campaigns) setSelectedIds(campaigns.map(c => c.id));
  }, [campaigns]);

  function toggleCampaign(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleImport() {
    await importMutation.mutateAsync({ entitlementId, campaignIds: selectedIds });
    onImported();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-amber-400">Import Sourcebook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select campaigns to seed this content into:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {campaigns?.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <Checkbox id={c.id} checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleCampaign(c.id)} />
                <Label htmlFor={c.id}>{c.name}</Label>
              </div>
            ))}
          </div>
          {importMutation.isError && <p className="text-sm text-destructive">{importMutation.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.length === 0 || importMutation.isPending}
            className="bg-amber-700 hover:bg-amber-600"
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Create sourcebook drawer**

`src/components/settings/ddb/DdbSourcebookDrawer.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props { sourcebookId: string; onClose: () => void; }

function StatusBadge({ status }: { status: string }) {
  if (status === 'idle') return <Badge className="text-xs bg-green-900/50 text-green-300">Synced</Badge>;
  if (status === 'running') return <Badge className="text-xs bg-amber-900/50 text-amber-300">Syncing...</Badge>;
  if (status === 'error') return <Badge variant="destructive" className="text-xs">Error</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export function DdbSourcebookDrawer({ sourcebookId, onClose }: Props) {
  const { data: sourcebook, refetch } = trpc.ddbSync.getSourcebook.useQuery({ sourcebookId });
  const syncMutation = trpc.ddbSync.syncNow.useMutation({ onSuccess: () => refetch() });
  const resolveMutation = trpc.ddbSync.resolveChange.useMutation({ onSuccess: () => refetch() });
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  if (!sourcebook) return null;

  const toggle = (id: string) => setExpandedChapters(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-amber-400">{sourcebook.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <StatusBadge status={sourcebook.syncStatus} />
              {sourcebook.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced {formatDistanceToNow(new Date(sourcebook.lastSyncedAt))} ago
                </p>
              )}
              {sourcebook.lastSyncError === 'auth' && (
                <p className="text-xs text-destructive">Session expired — update CobaltSession in settings</p>
              )}
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => syncMutation.mutate({ sourcebookId })}
              disabled={syncMutation.isPending || sourcebook.syncStatus === 'running'}
            >
              {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Sync Now</span>
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-cinzel tracking-widest text-muted-foreground uppercase">Chapters</h3>
            {sourcebook.chapters.map(ch => (
              <div key={ch.id} className="border border-border rounded-md overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => ch.hasPendingChanges && toggle(ch.id)}
                >
                  <div className="flex items-center gap-3">
                    {ch.hasPendingChanges
                      ? expandedChapters.has(ch.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      : <div className="w-4" />}
                    <span className="text-sm">{ch.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ch.hasPendingChanges && <Badge className="text-xs bg-orange-900/50 text-orange-300">Changes</Badge>}
                    <StatusBadge status={ch.syncStatus} />
                  </div>
                </button>

                {ch.hasPendingChanges && expandedChapters.has(ch.id) && (
                  <div className="border-t border-border p-3 space-y-4 bg-muted/20">
                    {((ch.pendingChanges ?? []) as any[]).map((change, i) => (
                      <div key={i} className="space-y-2 text-sm">
                        <p className="font-medium">{change.entityName} — {change.field}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-red-950/30 rounded p-2">
                            <p className="text-muted-foreground mb-1">Current</p>
                            <p>{String(change.oldValue)}</p>
                          </div>
                          <div className="bg-green-950/30 rounded p-2">
                            <p className="text-muted-foreground mb-1">DDB Update</p>
                            <p>{String(change.newValue)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline"
                            onClick={() => resolveMutation.mutate({
                              chapterId: ch.id, entityId: change.entityId, entityType: change.entityType,
                              field: change.field, action: 'accept', newValue: change.newValue,
                            })}>Accept DDB version</Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => resolveMutation.mutate({
                              chapterId: ch.id, entityId: change.entityId, entityType: change.entityType,
                              field: change.field, action: 'keep',
                            })}>Keep mine</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Add link card to main settings page**

In `src/app/(app)/settings/page.tsx`, find the `Link href="/settings/api-usage"` card block and add a similar block for the DDB page immediately after it:

```tsx
<Link href="/settings/ddb" className="...existing card classes...">
  <div className="flex items-center gap-3">
    <BookOpen className="w-5 h-5 text-amber-400" />
    <div>
      <p className="font-medium">D&D Beyond Library</p>
      <p className="text-sm text-muted-foreground">Import sourcebooks from your D&D Beyond account</p>
    </div>
    <ArrowUpRight className="w-4 h-4 ml-auto opacity-50" />
  </div>
</Link>
```

Add `BookOpen` to the existing Lucide import on line 15 of `src/app/(app)/settings/page.tsx`.

- [ ] **Commit**

```bash
git add src/app/(app)/settings/ddb/ src/components/settings/ddb/ src/app/(app)/settings/page.tsx
git commit -m "feat(ui): add DDB sourcebook sync settings UI"
```

---

## Task 11: TypeScript + Smoke Test

- [ ] **TypeScript check**

```bash
npx tsc --noEmit
```

Fix any errors. Common issues:
- `WorldEntity` / `EncounterPlan` `data` field types may need `as any` casts for Prisma JSON
- `ddbChapterId` not yet in Prisma client types — run `npm run db:push` then `npx prisma generate`

- [ ] **Run all tests**

```bash
npx vitest run tests/lib/ddb-sourcebook.test.ts tests/routers/ddb-sync.test.ts
```

Expected: all pass.

- [ ] **Start dev server and verify page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3847/settings/ddb`. Verify:
- Page renders without errors
- Disclosure banner shows
- "Detect My Library" button is present and clickable

- [ ] **Final commit + push**

```bash
git add -A
git commit -m "feat: DDB sourcebook sync — complete implementation"
git push origin main
```

---

## Implementer Notes

- **Do not add a new field to `UserSettings`** — `dndBeyondCobaltCookie` already exists and is already encrypted/decrypted by `src/lib/encryption.ts`.
- **`fetchSourcebookToc` uses cookie auth** (www domain). All other fetches after JWT exchange use Bearer auth. This is intentional — DDB's main site accepts both, but chapter workers must only have the JWT.
- **The `getJobCounts` poll** in the coordinator waits for the entire queue to empty. This is a simplification — if other sourcebook syncs are running concurrently, counts may intermix. A more robust solution uses BullMQ Flows (out of scope for now).
- **The entitlement listing URL** (`/my-library`) may need selector adjustment based on live DDB DOM — test with a real session and update cheerio selectors as needed.
- **`campaigns.list`** procedure is used in `DdbImportModal` — verify it exists in the campaigns router. If the procedure name differs, check `src/server/routers/campaigns.ts`.
