/**
 * Backfills imageUrl on WorldEntity NPC records for 5 Curse of Strahd characters
 * whose portraits were generated via Higgsfield (2026-05-16).
 *
 * Matches by name pattern (case-insensitive). Safe to re-run — only sets imageUrl
 * where it is currently null.
 *
 * Usage:
 *   npx tsx scripts/backfill-cos-npc-portraits.ts
 *   npx tsx scripts/backfill-cos-npc-portraits.ts --dry-run
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PORTRAITS: Array<{ label: string; patterns: string[]; imageUrl: string }> = [
  {
    label: 'Strahd',
    // Matches "Strahd", "Strahd von Zarovich", "Count Strahd von Zarovich"
    // Excludes zombies, spies, and the "Zarovichin I" variant
    patterns: ['strahd von zarovich', 'count strahd von zarovich', 'strahd'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142648_e4cdd021-f1ee-4710-ac5d-48391a0ed94d.png',
  },
  {
    label: 'Madam Eva',
    patterns: ['madam eva'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142653_b16191a3-1cb0-4bcf-9e2a-11d17dfaa4fe.png',
  },
  {
    label: 'Ireena Kolyana',
    patterns: ['ireena kolyana', 'ireena'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142658_3f86bf0f-6ad0-48dc-81ea-fa7ddc7660fc.png',
  },
  {
    label: 'Van Richten',
    // Matches "Van Richten", "Rudolph van Richten", "Rictavio (Dr. Rudolph van Richten)"
    patterns: ['van richten', 'rictavio'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142703_6524bf71-93ed-48c5-9ca9-bd554a33c830.png',
  },
  {
    label: 'Rahadin',
    patterns: ['rahadin'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142709_e01a9fd5-5c77-4901-8c46-64ebe63227ac.png',
  },
];

// Exclusion substrings — never match these regardless of pattern
const EXCLUSIONS = ['zombie', 'spies', 'zarovichin i'];

function isExcluded(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUSIONS.some((ex) => lower.includes(ex));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[dry-run] No writes will be made.\n');

  let totalUpdated = 0;

  for (const portrait of PORTRAITS) {
    // Find all WorldEntity NPC records matching any of the name patterns,
    // where imageUrl is not yet set.
    const candidates = await prisma.worldEntity.findMany({
      where: {
        type: 'NPC',
        imageUrl: null,
        OR: portrait.patterns.map((p) => ({
          name: { contains: p, mode: 'insensitive' as const },
        })),
      },
      select: { id: true, name: true, campaignId: true },
    });

    const matches = candidates.filter((c) => !isExcluded(c.name));

    if (matches.length === 0) {
      console.log(`${portrait.label}: no records to update`);
      continue;
    }

    console.log(`${portrait.label}: ${matches.length} record(s)`);
    for (const m of matches) {
      console.log(`  • ${m.name} (${m.id}) campaign=${m.campaignId}`);
    }

    if (!dryRun) {
      await prisma.worldEntity.updateMany({
        where: { id: { in: matches.map((m) => m.id) } },
        data: { imageUrl: portrait.imageUrl },
      });
      totalUpdated += matches.length;
    }
  }

  console.log(`\nDone. ${dryRun ? '(dry-run)' : `Updated ${totalUpdated} WorldEntity records.`}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
