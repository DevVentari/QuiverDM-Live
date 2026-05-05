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
}
