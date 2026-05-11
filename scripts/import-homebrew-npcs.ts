/**
 * Import HomebrewContent creatures/items as NPCs into the NPC table.
 * Run: DATABASE_URL="<neon-url>" npx tsx scripts/import-homebrew-npcs.ts
 */
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CAMPAIGN_ID = 'cmn1pdv3l000143ynkhvtw197';

function crToRole(cr: string | number | undefined): string {
  if (!cr) return 'Unknown';
  const n = parseFloat(String(cr));
  if (isNaN(n)) return String(cr);
  if (n <= 0.5) return 'Minion';
  if (n <= 2) return 'Skirmisher';
  if (n <= 5) return 'Elite';
  if (n <= 10) return 'Boss';
  if (n <= 15) return 'Legendary';
  return 'Ancient';
}

function descriptionFromData(name: string, data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.size && data.type) parts.push(`${data.size} ${data.type}`);
  if (data.alignment) parts.push(`(${data.alignment})`);
  if (data.challengeRating) parts.push(`· CR ${data.challengeRating}`);
  if (data.armorClass) parts.push(`· AC ${data.armorClass}`);
  if (data.hitPoints) parts.push(`· ${data.hitPoints} HP`);
  return parts.join(' ') || name;
}

async function main() {
  // All homebrew linked to campaign
  const homebrew = await prisma.homebrewContent.findMany({
    where: {
      campaigns: { some: { campaignId: CAMPAIGN_ID } },
      type: { in: ['creature', 'npc'] },
    },
    select: { id: true, name: true, type: true, data: true, tags: true },
  });
  console.log(`Found ${homebrew.length} creatures/npcs in campaign homebrew\n`);

  // Get existing NPC names to avoid dupes
  const existing = await prisma.nPC.findMany({
    where: { campaignId: CAMPAIGN_ID },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(n => n.name.toLowerCase()));

  let created = 0;
  let skipped = 0;

  for (const hb of homebrew) {
    if (existingNames.has(hb.name.toLowerCase())) {
      skipped++;
      continue;
    }

    const data = hb.data as Record<string, unknown>;
    const cr = (data.challengeRating ?? data.challenge_rating) as string | undefined;

    await prisma.nPC.create({
      data: {
        campaignId: CAMPAIGN_ID,
        name: hb.name,
        description: descriptionFromData(hb.name, data),
        role: crToRole(cr),
        faction: (data.type as string) ?? hb.tags[0] ?? null,
        stats: data,
        tags: [
          ...(data.size ? [String(data.size).toLowerCase()] : []),
          ...(data.type ? [String(data.type).toLowerCase()] : []),
          ...(cr ? [`cr${cr}`] : []),
          ...hb.tags.map(t => t.toLowerCase()),
        ].filter((v, i, a) => v && a.indexOf(v) === i),
        playerVisible: false,
      },
    });

    console.log(`  Created: ${hb.name} (CR ${cr ?? '?'})`);
    created++;
  }

  console.log(`\nDone: ${created} NPCs created, ${skipped} skipped (already exist)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
