/**
 * Enrich WorldEntity properties from matching HomebrewContent.
 * Copies stat block / item data into entity.properties for entities that
 * match homebrew content in the same campaign (by name similarity).
 *
 * Run: DATABASE_URL="<neon-url>" npx tsx scripts/enrich-brain-entities.ts
 */
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CAMPAIGN_ID = 'cmn1pdv3l000143ynkhvtw197';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  // Only allow substring match when the shorter string is at least 60% of the longer
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) return 0.85;
  // word overlap
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

function extractProperties(data: Record<string, unknown>, type: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  if (type === 'creature') {
    const fields = [
      'size', 'creature_type', 'alignment', 'armor_class', 'hit_points', 'hit_dice',
      'speed', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
      'challenge_rating', 'xp', 'senses', 'languages', 'damage_immunities',
      'damage_resistances', 'damage_vulnerabilities', 'condition_immunities',
    ];
    for (const f of fields) {
      if (data[f] != null && data[f] !== '') props[f] = data[f];
    }
    // Also grab saving_throws, skills as compact strings
    if (data.saving_throws && typeof data.saving_throws === 'object') {
      const st = data.saving_throws as Record<string, number>;
      const parts = Object.entries(st).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`);
      if (parts.length) props['saving_throws'] = parts.join(', ');
    }
    if (data.skills && typeof data.skills === 'object') {
      const sk = data.skills as Record<string, number>;
      const parts = Object.entries(sk).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`);
      if (parts.length) props['skills'] = parts.join(', ');
    }
  } else if (type === 'spell') {
    const fields = ['level', 'school', 'casting_time', 'range', 'components', 'duration', 'concentration'];
    for (const f of fields) {
      if (data[f] != null && data[f] !== '') props[f] = data[f];
    }
  } else if (type === 'item') {
    const fields = ['item_type', 'rarity', 'requires_attunement', 'weight', 'cost', 'damage', 'armor_class'];
    for (const f of fields) {
      if (data[f] != null && data[f] !== '') props[f] = data[f];
    }
  }

  return props;
}

async function main() {
  // Load all world entities for campaign
  const entities = await prisma.worldEntity.findMany({
    where: { campaignId: CAMPAIGN_ID },
    select: { id: true, name: true, type: true, properties: true },
  });
  console.log(`Found ${entities.length} world entities`);

  // Load all homebrew linked to campaign
  const homebrew = await prisma.homebrewContent.findMany({
    where: { campaigns: { some: { campaignId: CAMPAIGN_ID } } },
    select: { id: true, name: true, type: true, data: true },
  });
  console.log(`Found ${homebrew.length} homebrew items\n`);

  // Also load user's full homebrew (not just campaign-linked) for broader matching
  const allHomebrew = await prisma.homebrewContent.findMany({
    where: { userId: 'cmmhnjt720001am5akp79kcx2' },
    select: { id: true, name: true, type: true, data: true },
  });
  const combined = [...new Map([...homebrew, ...allHomebrew].map(h => [h.id, h])).values()];
  console.log(`Total homebrew pool: ${combined.length}\n`);

  let enriched = 0;
  let skipped = 0;

  for (const entity of entities) {
    // Find best matching homebrew
    let bestScore = 0;
    let bestMatch: (typeof combined)[0] | null = null;

    for (const hb of combined) {
      const score = similarity(entity.name, hb.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = hb;
      }
    }

    if (!bestMatch || bestScore < 0.7) {
      skipped++;
      continue;
    }

    const data = bestMatch.data as Record<string, unknown>;
    const newProps = extractProperties(data, bestMatch.type);

    if (Object.keys(newProps).length === 0) {
      skipped++;
      continue;
    }

    // Merge with existing properties
    const existing = (entity.properties as Record<string, unknown>) ?? {};
    const merged = { ...existing, ...newProps, _homebrew_id: bestMatch.id };

    await prisma.worldEntity.update({
      where: { id: entity.id },
      data: { properties: merged },
    });

    console.log(`  [${Math.round(bestScore * 100)}%] ${entity.name} → ${bestMatch.name} (${Object.keys(newProps).length} props)`);
    enriched++;
  }

  console.log(`\nDone: ${enriched} enriched, ${skipped} skipped (no match or no data)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
