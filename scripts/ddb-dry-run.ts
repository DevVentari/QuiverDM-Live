/**
 * DDB worker dry-run.
 *
 * Runs the chapter extraction pipeline against a real DDB sourcebook but writes
 * every would-be DB row to JSON files under docs/test-results/ddb-imports/<slug>/
 * instead of touching the database.
 *
 * Usage:
 *   pnpm tsx scripts/ddb-dry-run.ts <sourcebook-slug> [--user email] [--no-ai]
 *
 * Auth resolution:
 *   1. --user <email> looks up UserSettings.dndBeyondCobaltCookie (decrypts on the fly).
 *   2. Fallback: DDB_COBALT_SESSION env var (raw, unencrypted session string).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import path from 'path';
import { performance } from 'perf_hooks';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import {
  exchangeCobaltForJwt,
  fetchSourcebookToc,
  fetchUserEntitlements,
  DdbAuthError,
} from '@/lib/ddb-sourcebook';
import { processChapterJob } from '@/lib/queue/ddb-chapter-extract';
import { DryRunWriteSink } from '@/lib/queue/ddb-dry-run-sink';

interface CliArgs {
  sourcebookSlug: string;
  userEmail?: string;
  skipAi: boolean;
  outRoot: string;
}

const KNOWN_GAPS = [
  'AI prompt truncates prose at 3000 chars — long chapters lose >90% of content.',
  'No RAG ingestion in chapter worker (project memory says prose → RAG).',
  'Encounters only from H2 headings — sidebars, tables, treasure parcels are missed.',
  'Only monsters extracted — no items, magic items, traps, hazards, vehicles, spells.',
  'Drift detection only checks `name` field — stat changes are silent.',
  'NPC dedup is per-campaign by name only — same name across chapters silently merges.',
];

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0) {
    console.error('Usage: pnpm tsx scripts/ddb-dry-run.ts <sourcebook-slug> [--user email] [--no-ai]');
    process.exit(1);
  }
  return {
    sourcebookSlug: positional[0],
    userEmail: typeof flags.user === 'string' ? flags.user : undefined,
    skipAi: flags['no-ai'] === true,
    outRoot: typeof flags.out === 'string' ? flags.out : 'docs/test-results/ddb-imports',
  };
}

async function resolveCobaltSession(userEmail?: string): Promise<{ raw: string; encrypted: string }> {
  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
    if (!user) throw new Error(`No user with email ${userEmail}`);
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { dndBeyondCobaltCookie: true },
    });
    if (!settings?.dndBeyondCobaltCookie) {
      throw new Error(`User ${userEmail} has no CobaltSession in UserSettings`);
    }
    const raw = decrypt(settings.dndBeyondCobaltCookie);
    if (!raw) throw new Error('Failed to decrypt stored CobaltSession');
    return { raw, encrypted: settings.dndBeyondCobaltCookie };
  }
  const envSession = process.env.DDB_COBALT_SESSION;
  if (!envSession) {
    throw new Error('Either pass --user <email> or set DDB_COBALT_SESSION env var');
  }
  return { raw: envSession, encrypted: encrypt(envSession) };
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m${sec.toString().padStart(2, '0')}s`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[dry-run] sourcebook=${args.sourcebookSlug} skipAi=${args.skipAi}`);

  const { raw: cobaltSession, encrypted: cobaltSessionEncrypted } = await resolveCobaltSession(args.userEmail);

  let cobaltJwt: string;
  try {
    cobaltJwt = await exchangeCobaltForJwt(cobaltSession);
  } catch (e) {
    if (e instanceof DdbAuthError) {
      console.error('[dry-run] CobaltSession invalid or expired. Refresh with `npm run ddb:refresh`.');
      process.exit(2);
    }
    throw e;
  }
  console.log('[dry-run] auth ok');

  let title: string | undefined;
  try {
    const ents = await fetchUserEntitlements(cobaltSession);
    const match = ents.find(e => e.slug === args.sourcebookSlug);
    if (!match) {
      console.warn(`[dry-run] sourcebook "${args.sourcebookSlug}" NOT in entitlements list — proceeding anyway.`);
      console.warn(`[dry-run] available entitlements (${ents.length}):`);
      for (const e of ents) console.warn(`  - ${e.slug.padEnd(20)} ${e.title}`);
    } else {
      title = match.title;
      console.log(`[dry-run] entitlement: ${match.title}`);
    }
  } catch (e) {
    console.warn(`[dry-run] could not fetch entitlements: ${(e as Error).message}`);
  }

  console.log('[dry-run] fetching TOC...');
  const toc = await fetchSourcebookToc(args.sourcebookSlug, cobaltSession);
  if (toc.length === 0) {
    console.error('[dry-run] empty TOC — sourcebook slug may be wrong or page structure changed.');
    process.exit(3);
  }
  console.log(`[dry-run] TOC: ${toc.length} chapters`);

  const outDir = path.resolve(args.outRoot, args.sourcebookSlug);
  const sink = new DryRunWriteSink({ outDir, sourcebookSlug: args.sourcebookSlug, sourcebookTitle: title });
  await sink.init();
  console.log(`[dry-run] writing to ${outDir}`);

  const overallStart = performance.now();
  const completedTimings: number[] = [];

  for (let i = 0; i < toc.length; i++) {
    const chapter = toc[i];
    const chapterId = `dry-${args.sourcebookSlug}-${chapter.slug}`;
    sink.beginChapter({ chapterId, chapterSlug: chapter.slug, chapterIndex: i });

    const chStart = performance.now();
    const label = `[${(i + 1).toString().padStart(2)}/${toc.length}] ${chapter.slug}`;
    process.stdout.write(`${label} ... `);

    try {
      await processChapterJob(
        {
          chapterId,
          sourcebookId: 'dry-sourcebook',
          userId: 'dry-user',
          sourceSlug: args.sourcebookSlug,
          chapterSlug: chapter.slug,
          cobaltJwt,
          cobaltSessionEncrypted,
          campaignIds: ['dry-campaign'],
        },
        {
          sink,
          skipAi: args.skipAi,
          skipChapterRead: true,
          chapterIndex: i,
        }
      );
    } catch (e) {
      const msg = (e as Error).message;
      await sink.recordIssue({ chapterId, severity: 'error', message: `processChapterJob threw: ${msg}` });
      process.stdout.write(`ERROR (${msg}) `);
    }

    await sink.flushChapter(chapterId);

    const chMs = performance.now() - chStart;
    sink.recordChapterTiming(chapterId, chMs);
    completedTimings.push(chMs);

    const avg = completedTimings.reduce((a, b) => a + b, 0) / completedTimings.length;
    const remaining = toc.length - i - 1;
    const etaMs = remaining * avg;
    const elapsedMs = performance.now() - overallStart;
    process.stdout.write(
      `${formatDuration(chMs)} | avg ${formatDuration(avg)} | elapsed ${formatDuration(elapsedMs)} | ETA ${formatDuration(etaMs)}\n`
    );
  }

  const summary = await sink.writeSummary(KNOWN_GAPS);
  const totalMs = performance.now() - overallStart;
  console.log('');
  console.log(`[dry-run] DONE in ${formatDuration(totalMs)}`);
  console.log(
    `[dry-run] totals: chapters=${summary.totals.chapters} monsters=${summary.totals.monstersExtracted} (skipped ${summary.totals.monstersSkipped}) encounters=${summary.totals.encounters} npcs=${summary.totals.npcs} locations=${summary.totals.locations}`
  );
  console.log(
    `[dry-run] AI: ${summary.totals.aiSuccess} parsed, ${summary.totals.aiParseFailure} parse-failed, ${summary.totals.aiNotAttempted} not attempted`
  );
  console.log(`[dry-run] artifacts: ${outDir}`);

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[dry-run] fatal:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
