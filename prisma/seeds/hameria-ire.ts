import { PrismaClient, CampaignRole } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const JSON_DIR = path.join(process.cwd(), 'docs/hameria-ire-jsons');

function readJson(filename: string): any {
  const filepath = path.join(JSON_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function toSearchText(content: string, title: string, tags: string[]): string {
  const stripped = content.replace(/[#*`\[\]()_~>|]/g, ' ').replace(/\s+/g, ' ').trim();
  return [title, ...tags, stripped.slice(0, 2000)].join(' ');
}

export async function seedHameriaIre(prisma: PrismaClient, userId: string) {
  // Campaign
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'tales-from-the-bonfire-keep' },
    update: {
      name: 'Tales from the Bonfire Keep',
    },
    create: {
      name: 'Tales from the Bonfire Keep',
      slug: 'tales-from-the-bonfire-keep',
      description:
        'A cosmic D&D campaign set in Hameria Ire — a world held in stasis by an ancient crime, on the edge of reckoning.',
      status: 'active',
      userId,
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  // NPCs
  const npcFile = readJson('npcs_npcs.json');
  const npcs: any[] = npcFile.data ?? [];
  let npcCount = 0;

  for (const npc of npcs) {
    if (!npc.name || npc.name.trim() === '' || npc.name === 'Features') continue;

    const existing = await prisma.nPC.findFirst({
      where: { campaignId: campaign.id, name: npc.name },
    });
    if (existing) continue;

    const description = [npc.description, npc.personality].filter(Boolean).join('\n\n') || null;

    await prisma.nPC.create({
      data: {
        campaignId: campaign.id,
        name: npc.name,
        description,
        role: npc.type_alignment || null,
        stats: {
          mechanics: npc.mechanics ?? {},
          traits: npc.traits ?? [],
          actions: npc.actions ?? [],
          ability_scores: npc.ability_scores ?? {},
          ideals: npc.ideals ?? null,
          bonds: npc.bonds ?? null,
          flaws: npc.flaws ?? null,
        },
        tags: npcFile.metadata?.tags ?? [],
      },
    });
    npcCount++;
  }

  console.log(`Seeded ${npcCount} NPCs for Tales from the Bonfire Keep`);

  // Sessions (adventures)
  const adventureFiles = [
    'adventures_01-whispered-names.json',
    'adventures_01b-the-withered-root.json',
    'adventures_01c-the-salted-current.json',
    'adventures_02-the-starfall-conspiracy.json',
    'adventures_03-the-withering-world.json',
    'adventures_04-desperate-alliance.json',
    'adventures_05-the-hunt-begins.json',
    'adventures_06-the-dreaming-deep.json',
    'adventures_07-the-glass-sea.json',
  ];

  const existingSessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    select: { sessionNumber: true },
  });
  const existingNumbers = new Set(existingSessions.map((s) => s.sessionNumber));

  let sessionCount = 0;
  for (let i = 0; i < adventureFiles.length; i++) {
    const file = adventureFiles[i];
    if (!fs.existsSync(path.join(JSON_DIR, file))) {
      console.warn(`[hameria-ire seed] Adventure file not found: ${file}`);
      continue;
    }
    const adventure = readJson(file);
    const sessionNumber = (adventure.metadata?.weight ?? i + 1) as number;

    if (existingNumbers.has(sessionNumber)) continue;

    await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber,
        title: adventure.metadata?.title ?? file,
        status: 'planning',
        prepData: { rawContent: adventure.content ?? '' },
      },
    });
    existingNumbers.add(sessionNumber);
    sessionCount++;
  }

  console.log(`Seeded ${sessionCount} sessions for Tales from the Bonfire Keep`);

  // Homebrew content — items
  const itemFiles = ['mechanics_items.json', 'mechanics_pregenitor-artifacts.json'];
  let itemCount = 0;

  for (const itemFile of itemFiles) {
    if (!fs.existsSync(path.join(JSON_DIR, itemFile))) continue;
    const file = readJson(itemFile);
    const items: any[] = file.data ?? [];
    for (const item of items) {
      if (!item.name || item.name.startsWith('...') || item.name === '') continue;
      const existing = await prisma.homebrewContent.findFirst({
        where: { userId, name: item.name, type: 'item' },
      });
      if (existing) continue;
      await prisma.homebrewContent.create({
        data: {
          userId,
          type: 'item',
          name: item.name,
          data: { properties: item.properties ?? [], rarity_type: item.rarity_type ?? '', description: item.description ?? '' },
          tags: file.metadata?.tags ?? [],
          searchText: toSearchText(item.description ?? '', item.name, file.metadata?.tags ?? []),
          sourceType: 'manual',
        },
      });
      itemCount++;
    }
  }
  console.log(`Seeded ${itemCount} items for Tales from the Bonfire Keep`);

  // Homebrew content — monsters
  const monsterFile = readJson('bestiary_monsters.json');
  const monsters: any[] = monsterFile.data ?? [];
  let creatureCount = 0;

  for (const monster of monsters) {
    if (!monster.name || monster.name.startsWith('...') || monster.name === '') continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, name: monster.name, type: 'creature' },
    });
    if (existing) continue;

    await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'creature',
        name: monster.name,
        data: {
          mechanics: monster.mechanics ?? {},
          traits: monster.traits ?? [],
          actions: monster.actions ?? [],
          ability_scores: monster.ability_scores ?? {},
          type_alignment: monster.type_alignment ?? '',
        },
        tags: monsterFile.metadata?.tags ?? [],
        searchText: toSearchText(
          monster.description ?? '',
          monster.name,
          monsterFile.metadata?.tags ?? []
        ),
        sourceType: 'manual',
      },
    });
    creatureCount++;
  }

  // Homebrew content — races
  const racesFile = readJson('mechanics_races.json');
  const races: any[] = racesFile.data ?? [];
  let raceCount = 0;

  for (const race of races) {
    if (!race.name || race.name.startsWith('...') || race.name === '') continue;

    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, name: race.name, type: 'race' },
    });
    if (existing) continue;

    await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'race',
        name: race.name,
        data: {
          traits: race.traits ?? [],
          subraces: race.subraces ?? [],
        },
        tags: racesFile.metadata?.tags ?? [],
        searchText: toSearchText(race.description ?? '', race.name, racesFile.metadata?.tags ?? []),
        sourceType: 'manual',
      },
    });
    raceCount++;
  }

  console.log(`Seeded ${creatureCount} creatures, ${raceCount} races for Tales from the Bonfire Keep`);

  // Campaign documents — factions, lore, locations, timeline
  const documentSources: Array<{ file: string; type: string }> = [
    { file: 'factions_factions.json', type: 'faction' },
    { file: 'factions_solar-lie.json', type: 'faction' },
    { file: 'factions_tidal-adaptation.json', type: 'faction' },
    { file: 'factions_twelve-witnesses.json', type: 'faction' },
    { file: 'factions_verdant-burden.json', type: 'faction' },
    { file: 'world-lore_anchors-and-heartflame.json', type: 'lore' },
    { file: 'world-lore_campaign-timeline.json', type: 'timeline' },
    { file: 'world-lore_world-timeline.json', type: 'timeline' },
    { file: 'world-lore_locations.json', type: 'location' },
  ];

  let docCount = 0;
  for (const source of documentSources) {
    if (!fs.existsSync(path.join(JSON_DIR, source.file))) {
      console.warn(`[hameria-ire seed] Document file not found: ${source.file}`);
      continue;
    }
    const doc = readJson(source.file);
    const title = doc.metadata?.title ?? source.file.replace('.json', '');
    const slug = toSlug(title);
    const content = doc.content ?? '';
    const tags: string[] = doc.metadata?.tags ?? [];

    await prisma.campaignDocument.upsert({
      where: { campaignId_slug: { campaignId: campaign.id, slug } },
      update: {},
      create: {
        campaignId: campaign.id,
        title,
        slug,
        type: source.type,
        content,
        data: Array.isArray(doc.data) && doc.data.length > 0 ? doc.data : undefined,
        tags,
        sourceFile: doc.source ?? source.file,
        searchText: toSearchText(content, title, tags),
        brainIngestStatus: 'none',
      },
    });
    docCount++;
  }

  console.log(`Seeded ${docCount} campaign documents for Tales from the Bonfire Keep`);

  // Players (pregenerated characters)
  const playerFiles = [
    'Player Characters_Norm Alfella.json',
    'Player Characters_Oriyen Vale.json',
    'Player Characters_Skreek Swicschnout.json',
  ];
  let playerCount = 0;
  for (const file of playerFiles) {
    if (!fs.existsSync(path.join(JSON_DIR, file))) continue;
    const pc = readJson(file);
    const rawTitle: string = pc.metadata?.title ?? file.replace('.json', '');
    const characterName = rawTitle.includes('_') ? rawTitle.split('_').slice(1).join('_').trim() : rawTitle;
    if (!characterName) continue;
    const existing = await prisma.player.findFirst({ where: { campaignId: campaign.id, characterName } });
    if (existing) continue;
    const content: string = pc.content ?? '';
    const raceMatch = content.match(/\*\*Race[:\*]+\*+\s*([^\n*|]+)/i);
    const classMatch = content.match(/\*\*Class[:\*]+\*+\s*([^\n*|]+)/i);
    const levelMatch = content.match(/\*\*Level[:\*]+\*+\s*(\d+)/i);
    await prisma.player.create({
      data: {
        campaignId: campaign.id,
        name: 'Demo Player',
        characterName,
        characterRace: raceMatch ? raceMatch[1].trim() : null,
        characterClass: classMatch ? classMatch[1].trim() : null,
        level: levelMatch ? parseInt(levelMatch[1], 10) : 1,
        backstory: content.slice(0, 3000) || null,
      },
    });
    playerCount++;
  }
  console.log(`Seeded ${playerCount} players for Tales from the Bonfire Keep`);
}
