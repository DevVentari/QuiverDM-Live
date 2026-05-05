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
    const finalNumber = existingNumbers.has(sessionNumber) ? sessionNumber + 100 + i : sessionNumber;

    if (existingNumbers.has(finalNumber)) continue;

    await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber: finalNumber,
        title: adventure.metadata?.title ?? file,
        status: 'planning',
        prepData: { rawContent: adventure.content ?? '' },
      },
    });
    existingNumbers.add(finalNumber);
    sessionCount++;
  }

  console.log(`Seeded ${sessionCount} sessions for Tales from the Bonfire Keep`);
}
