// Usage: npx tsx scripts/import-world-from-gdrive.ts
// Imports world content from Google Drive MD files into WorldEntry records.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import fs from 'fs';
import path from 'path';
import { WorldEntryType } from '@prisma/client';
import { prisma } from '../src/server/db';
import { worldRepository } from '../src/server/repositories/world.repository';

const CAMPAIGN_SLUG = 'tales-from-the-bonfire-keep';
const GDRIVE_ROOT = 'G:\\My Drive\\Notebooks\\Dungeons and Dragons\\Campaigns\\Tales from The Bonfire Keep - AI Edits';
const TBFK = path.join(GDRIVE_ROOT, 'Tales From The Bonfire Keep');

// ─── Utility ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')   // strip leading "1. "
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseFrontmatter(raw: string): { body: string; tags: string[]; title?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { body: raw, tags: [] };
  const yaml = match[1];
  const body = match[2];
  const tagsMatch = yaml.match(/tags:\s*\[([^\]]*)\]/s);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '').trim()).filter(Boolean)
    : [];
  const titleMatch = yaml.match(/title:\s*["']?([^"'\n]+)["']?/);
  return { body, tags, title: titleMatch?.[1]?.trim() };
}

function splitByH2(body: string): Array<{ name: string; content: string }> {
  const parts = body.split(/(?=^## )/m).filter(s => s.trim());
  return parts
    .filter(p => p.startsWith('## '))
    .map(section => {
      const newline = section.indexOf('\n');
      const heading = newline > -1 ? section.slice(3, newline).trim() : section.slice(3).trim();
      const content = newline > -1 ? section.slice(newline + 1).trim() : '';
      const name = heading.replace(/^\d+\.\s*/, '').trim();
      return { name, content };
    })
    .filter(e => e.name.length > 0);
}

// ─── Per-type structured data parsers ─────────────────────────────────────────

function parseMonsterData(content: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};

  const subtitle = content.match(/^\*([^*]+)\*/m)?.[1]?.trim();
  if (subtitle) {
    const commaIdx = subtitle.indexOf(',');
    const sizeTypeRaw = commaIdx > -1 ? subtitle.slice(0, commaIdx).trim() : subtitle;
    d.alignment = commaIdx > -1 ? subtitle.slice(commaIdx + 1).trim() : '';
    const sizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    const size = sizes.find(s => sizeTypeRaw.startsWith(s));
    if (size) { d.size = size; d.type = sizeTypeRaw.slice(size.length).trim().replace(/^[\s/]+/, ''); }
    else d.type = sizeTypeRaw;
  }

  const tableVal = (label: string) =>
    content.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|\\n]+)\\|`, 'i'))?.[1]?.trim();

  const acStr = tableVal('Armor Class');
  if (acStr) {
    d.ac = parseInt(acStr.match(/^(\d+)/)?.[1] ?? '0', 10) || undefined;
    d.acNote = acStr.match(/\(([^)]+)\)/)?.[1];
  }
  const hpStr = tableVal('Hit Points');
  if (hpStr) {
    d.hp = parseInt(hpStr.match(/^(\d+)/)?.[1] ?? '0', 10) || undefined;
    d.hpNote = hpStr.match(/\(([^)]+)\)/)?.[1];
  }
  d.speed = tableVal('Speed');

  const abilityMatch = content.match(
    /\|\s*STR\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*\n\|[-|\s]+\|\s*\n\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/i
  );
  if (abilityMatch) {
    const score = (s: string) => parseInt(s.trim().match(/^(\d+)/)?.[1] ?? '10', 10);
    d.abilityScores = {
      str: score(abilityMatch[1]),
      dex: score(abilityMatch[2]),
      con: score(abilityMatch[3]),
      int: score(abilityMatch[4]),
      wis: score(abilityMatch[5]),
      cha: score(abilityMatch[6]),
    };
  }

  const crMatch = content.match(/\*\*Challenge[:\*]*\*+\s*([^\s(]+)/i);
  if (crMatch) d.cr = crMatch[1];
  const xpMatch = content.match(/\(([0-9,]+)\s*XP\)/i);
  if (xpMatch) d.xp = parseInt(xpMatch[1].replace(/,/g, ''), 10);

  const listVal = (label: string) => {
    const m = content.match(new RegExp(`\\*\\*${label}[:\\*]*\\*+\\s*([^\\n]+)`, 'i'));
    return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : undefined;
  };
  d.resistances = listVal('Damage Resistances');
  d.immunities = listVal('Damage Immunities');
  d.conditionImmunities = listVal('Condition Immunities');
  const senses = content.match(/\*\*Senses[:\*]*\*+\s*([^\n]+)/i)?.[1]?.trim();
  if (senses) d.senses = senses;

  const actionsIdx = content.search(/^### Actions/im);
  const traitsText = actionsIdx > -1 ? content.slice(0, actionsIdx) : content;
  const actionsText = actionsIdx > -1 ? content.slice(actionsIdx) : '';

  const extractBlocks = (text: string) =>
    [...text.matchAll(/\*\*([^*.]+)\.\*\*\s+([\s\S]*?)(?=\n\n\*\*|\n\n###|$)/g)].map(m => ({
      name: m[1].trim(),
      description: m[2].trim(),
    }));

  d.traits = extractBlocks(traitsText);
  d.actions = extractBlocks(actionsText);
  d.reactions = [];
  d.legendaryActions = [];

  return d;
}

function parseLocationData(content: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};

  const infoTable = content.match(/## Basic Information[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const parseInfoTable = (text: string, label: string) =>
    text.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|\\n]+)\\|`, 'i'))?.[1]?.trim();
  d.population = parseInfoTable(infoTable, 'Population');
  d.government = parseInfoTable(infoTable, 'Government');
  d.defenses = parseInfoTable(infoTable, 'Defenses');
  d.commerce = parseInfoTable(infoTable, 'Commerce');

  const locSection = content.match(/## Notable Locations[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const locRows = [...locSection.matchAll(/\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|/g)]
    .filter(m => !m[1].startsWith('-') && m[1] !== 'Location')
    .map(m => ({ name: m[1].trim(), type: m[2].trim(), description: m[3].trim() }));
  if (locRows.length) d.notableLocations = locRows;

  const npcSection = content.match(/## Notable NPCs[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const npcRows = [...npcSection.matchAll(/\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|/g)]
    .filter(m => !m[1].startsWith('-') && m[1] !== 'Name')
    .map(m => ({ name: m[1].trim(), role: m[2].trim(), description: m[3].trim() }));
  if (npcRows.length) d.notableNPCs = npcRows;

  const hooksSection = content.match(/## Adventure[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const hookRows = [...hooksSection.matchAll(/\|\s*([^|*\-][^|]+)\|\s*([^|]+)\|/g)]
    .filter(m => m[1].trim() !== 'Opportunity Type' && !m[1].includes('---'))
    .map(m => m[2].trim())
    .filter(Boolean);
  if (hookRows.length) d.adventureHooks = hookRows;

  return d;
}

function parseItemData(content: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};

  const subtitle = content.match(/^\*([^*]+)\*/m)?.[1]?.trim() ?? '';
  const commaIdx = subtitle.indexOf(',');
  d.itemType = commaIdx > -1 ? subtitle.slice(0, commaIdx).trim() : subtitle;
  const rarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];
  const foundRarity = rarities.find(r => subtitle.toLowerCase().includes(r));
  if (foundRarity) d.rarity = foundRarity;
  d.requiresAttunement = subtitle.toLowerCase().includes('attunement');

  const propsSection = content.match(/## Properties[\s\S]*?(?=\n##|$)/i)?.[0] ?? content;
  const props = [...propsSection.matchAll(/^- \*\*([^*]+)\*\*[:\s]+(.+)$/gm)]
    .map(m => `${m[1].trim()}: ${m[2].trim()}`);
  if (props.length) d.properties = props;

  const dmg = propsSection.match(/\*\*Damage\*\*[:\s]+([^\n]+)/i)?.[1]?.trim();
  if (dmg) d.damage = dmg;

  const curse = content.match(/## Curse[\s\S]*?(?=\n##|$)/i)?.[0];
  if (curse) d.curse = curse.replace(/^## Curse\s*/i, '').trim();

  return d;
}

function parseFactionData(content: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};

  const goalSection = content.match(/## Goals?[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const goals = [...goalSection.matchAll(/^[-*]\s+(.+)$/gm)].map(m => m[1].trim());
  if (goals.length) d.goals = goals;

  const memberSection = content.match(/## (Key Members?|Leadership|Members?)[\s\S]*?(?=\n##|$)/i)?.[0] ?? '';
  const members = [...memberSection.matchAll(/\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/g)]
    .filter(m => !m[1].startsWith('-') && m[1] !== 'Name' && m[1] !== 'Member')
    .map(m => ({ name: m[1].trim(), role: m[2].trim() }));
  if (members.length) d.keyMembers = members;

  const hqMatch = content.match(/\*\*Headquarters?\*\*[:\s]+([^\n|]+)/i);
  if (hqMatch) d.headquarters = hqMatch[1].trim();

  return d;
}

// ─── Entry builder ────────────────────────────────────────────────────────────

interface FileSpec {
  filePath: string;
  type: WorldEntryType;
  split: 'h2' | 'single';
  extra?: Record<string, unknown>;
  singleName?: string;
}

function buildSpecs(): FileSpec[] {
  return [
    { filePath: path.join(GDRIVE_ROOT, 'Anchors and Heartflame.md'), type: WorldEntryType.LORE, split: 'single', singleName: 'Anchors and Heartflame' },
    { filePath: path.join(GDRIVE_ROOT, 'Campaign Timeline.md'), type: WorldEntryType.TIMELINE, split: 'single', singleName: 'Campaign Timeline' },
    { filePath: path.join(GDRIVE_ROOT, 'World Timeline.md'), type: WorldEntryType.TIMELINE, split: 'single', singleName: 'World Timeline' },
    { filePath: path.join(GDRIVE_ROOT, 'The Solar Lie.md'), type: WorldEntryType.FACTION, split: 'single', singleName: 'The Solar Lie' },
    { filePath: path.join(GDRIVE_ROOT, 'The Tidal Adaptation.md'), type: WorldEntryType.FACTION, split: 'single', singleName: 'The Tidal Adaptation' },
    { filePath: path.join(GDRIVE_ROOT, 'The Verdant Burden.md'), type: WorldEntryType.FACTION, split: 'single', singleName: 'The Verdant Burden' },
    { filePath: path.join(TBFK, 'Locations.md'), type: WorldEntryType.LOCATION, split: 'h2' },
    { filePath: path.join(TBFK, 'NPCs.md'), type: WorldEntryType.NPC, split: 'h2' },
    { filePath: path.join(TBFK, 'Monsters.md'), type: WorldEntryType.MONSTER, split: 'h2' },
    { filePath: path.join(TBFK, 'Items.md'), type: WorldEntryType.ITEM, split: 'h2' },
    { filePath: path.join(TBFK, 'Pregenitor Artifacts.md'), type: WorldEntryType.ITEM, split: 'h2', extra: { tier: 'artifact' } },
    { filePath: path.join(TBFK, 'Factions.md'), type: WorldEntryType.FACTION, split: 'h2' },
    { filePath: path.join(TBFK, 'Races.md'), type: WorldEntryType.RACE, split: 'h2' },
    { filePath: path.join(TBFK, 'The Twelve Witnesses.md'), type: WorldEntryType.FACTION, split: 'single', singleName: 'The Twelve Witnesses' },
    { filePath: path.join(TBFK, 'Systems.md'), type: WorldEntryType.LORE, split: 'single', singleName: 'Systems and Mechanics' },
    { filePath: path.join(TBFK, 'Player Characters', 'Norm Alfella.md'), type: WorldEntryType.PC, split: 'single', singleName: 'Norm Alfella' },
    { filePath: path.join(TBFK, 'Player Characters', 'Oriyen Vale.md'), type: WorldEntryType.PC, split: 'single', singleName: 'Oriyen Vale' },
    { filePath: path.join(TBFK, 'Player Characters', 'Skreek Swicschnout.md'), type: WorldEntryType.PC, split: 'single', singleName: 'Skreek Swicschnout' },
  ];
}

function parseStructuredData(type: WorldEntryType, content: string, extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  try {
    let base: Record<string, unknown> = {};
    if (type === WorldEntryType.MONSTER) base = parseMonsterData(content);
    else if (type === WorldEntryType.LOCATION) base = parseLocationData(content);
    else if (type === WorldEntryType.ITEM) base = parseItemData(content);
    else if (type === WorldEntryType.FACTION) base = parseFactionData(content);
    return Object.keys({ ...base, ...extra }).length > 0 ? { ...base, ...extra } : undefined;
  } catch {
    return extra && Object.keys(extra).length > 0 ? extra : undefined;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const campaign = await prisma.campaign.findUnique({
    where: { slug: CAMPAIGN_SLUG },
    select: { id: true, name: true },
  });
  if (!campaign) { console.error(`Campaign not found: ${CAMPAIGN_SLUG}`); process.exit(1); }
  console.log(`Importing world entries for: ${campaign.name}\n`);

  const specs = buildSpecs();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const spec of specs) {
    if (!fs.existsSync(spec.filePath)) {
      console.warn(`  [skip] File not found: ${spec.filePath}`);
      skipped++;
      continue;
    }

    const raw = fs.readFileSync(spec.filePath, 'utf-8');
    const { body, tags } = parseFrontmatter(raw);

    const entries: Array<{ name: string; content: string }> =
      spec.split === 'h2'
        ? splitByH2(body)
        : [{ name: spec.singleName ?? path.basename(spec.filePath, '.md'), content: body }];

    for (const entry of entries) {
      if (!entry.name.trim()) continue;
      const slug = toSlug(entry.name);
      const structuredData = parseStructuredData(spec.type, entry.content, spec.extra);

      const existing = await prisma.worldEntry.findUnique({
        where: { campaignId_slug: { campaignId: campaign.id, slug } },
        select: { id: true },
      });

      await worldRepository.upsertEntry(campaign.id, {
        type: spec.type,
        name: entry.name,
        slug,
        content: entry.content,
        structuredData,
        tags,
        sourceFile: `${path.basename(spec.filePath)}#${entry.name}`,
      });

      if (existing) {
        console.log(`  [update] ${spec.type} "${entry.name}"`);
        updated++;
      } else {
        console.log(`  [create] ${spec.type} "${entry.name}"`);
        created++;
      }
    }
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} files skipped`);

  console.log('\nLinking to WorldEntity (Brain)...');
  const allEntries = await prisma.worldEntry.findMany({
    where: { campaignId: campaign.id, worldEntityId: null },
    select: { id: true, name: true },
  });
  let linked = 0;
  for (const entry of allEntries) {
    const entity = await prisma.worldEntity.findFirst({
      where: { campaignId: campaign.id, name: { equals: entry.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (entity) {
      await worldRepository.linkToWorldEntity(entry.id, entity.id);
      linked++;
    }
  }
  console.log(`Linked ${linked} entries to brain entities`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
