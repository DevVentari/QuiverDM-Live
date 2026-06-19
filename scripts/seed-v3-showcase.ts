/**
 * Seeds a fully-populated "v3 showcase" campaign so every wired v3 screen renders
 * real content. It carries the party + world from an existing source campaign
 * (default: curse-of-strahd) into a fresh `v3-showcase` campaign and backfills the
 * tables v3 reads but the source lacks (legacy NPCs, sessions/phases/routes, scenes).
 *
 * Idempotent: deletes and recreates the destination campaign on each run (cascade),
 * so the source campaign and shared Character rows are never mutated.
 *
 *   npx tsx scripts/seed-v3-showcase.ts
 */
import { prisma } from '../src/server/db';

const SRC_SLUG = process.env.SRC_SLUG ?? 'curse-of-strahd';
const DST_SLUG = process.env.DST_SLUG ?? 'v3-showcase';
const DST_NAME = "V3 Showcase — Curse of Strahd";

async function main() {
  const src = await prisma.campaign.findUnique({
    where: { slug: SRC_SLUG },
    select: { id: true, userId: true },
  });
  if (!src) throw new Error(`Source campaign '${SRC_SLUG}' not found`);
  const ownerId = src.userId;

  // Fresh start — drop the previous showcase (cascade removes its children;
  // CampaignCharacter links cascade off the campaign, leaving the shared
  // Character rows that also belong to the source campaign intact).
  await prisma.campaign.deleteMany({ where: { slug: DST_SLUG } });

  const dst = await prisma.campaign.create({
    data: {
      name: DST_NAME,
      slug: DST_SLUG,
      description: 'A fully-populated copy of Curse of Strahd for exercising every wired v3 surface.',
      status: 'active',
      userId: ownerId,
    },
  });
  console.log(`Created campaign ${dst.slug} (${dst.id}) owned by ${ownerId}`);

  // Owner membership + a CO_DM test account (vic) if present.
  await prisma.campaignMember.create({ data: { campaignId: dst.id, userId: ownerId, role: 'OWNER' } });
  const vic = await prisma.user.findFirst({ where: { email: 'vic@test.local' }, select: { id: true } });
  if (vic && vic.id !== ownerId) {
    await prisma.campaignMember.create({ data: { campaignId: dst.id, userId: vic.id, role: 'CO_DM' } });
  }

  // 1) Carry over the party — link the source campaign's characters (portable).
  const srcChars = await prisma.campaignCharacter.findMany({
    where: { campaignId: src.id },
    select: { characterId: true },
  });
  for (const c of srcChars) {
    await prisma.campaignCharacter.create({
      data: { campaignId: dst.id, characterId: c.characterId, status: 'ACTIVE', isActive: true },
    });
  }
  console.log(`Linked ${srcChars.length} characters`);

  // 2) Copy the source world entities (locations / factions / threats).
  const srcEnts = await prisma.worldEntity.findMany({
    where: { campaignId: src.id },
    select: { type: true, name: true, description: true, status: true, properties: true, aliases: true },
  });
  const idByName = new Map<string, string>();
  for (const e of srcEnts) {
    const created = await prisma.worldEntity.create({
      data: {
        campaignId: dst.id,
        type: e.type,
        name: e.name,
        description: e.description,
        status: e.status,
        properties: e.properties ?? {},
        aliases: e.aliases ?? [],
      },
    });
    idByName.set(e.name, created.id);
  }

  // 3) Add the canonical CoS cast as NPC-type brain entities (source has none).
  const cast: { name: string; description: string; properties?: Record<string, unknown> }[] = [
    { name: 'Ireena Kolyana', description: 'Ward of the late burgomaster; Strahd believes she is the reincarnation of Tatyana.' },
    { name: 'Ismark Kolyanovich', description: "Ireena's brother, the 'Lesser'; wants her safe behind Vallaki's walls." },
    { name: 'Madam Eva', description: 'Ancient Vistani seer at Tser Pool; reads the Tarokka that shapes the hunt.' },
    { name: 'Donavich', description: 'Broken priest of Barovia, praying over his vampire-spawn son Doru beneath the church.' },
  ];
  for (const n of cast) {
    const created = await prisma.worldEntity.create({
      data: { campaignId: dst.id, type: 'NPC', name: n.name, description: n.description, status: 'active', properties: n.properties ?? {} },
    });
    idByName.set(n.name, created.id);
  }

  // 4) Relationships among the cast (NPC screen "Relationships" panel reads these).
  const rel = (from: string, to: string, type: string, strength: number, description: string) => {
    const fromId = idByName.get(from);
    const toId = idByName.get(to);
    if (!fromId || !toId) return null;
    return prisma.worldRelationship.create({
      data: { campaignId: dst.id, fromEntityId: fromId, toEntityId: toId, type, strength, description },
    });
  };
  await Promise.all([
    rel('Strahd von Zarovich', 'Ireena Kolyana', 'obsessed with', 1.0, 'Sees Tatyana reborn; means to make her his bride.'),
    rel('Ismark Kolyanovich', 'Ireena Kolyana', 'sibling of', 0.9, 'Devoted older brother, sworn to protect her.'),
    rel('Vistani', 'Strahd von Zarovich', 'loyal to', 0.8, 'Many Vistani serve the devil Strahd as eyes and messengers.'),
    rel('Donavich', 'Strahd von Zarovich', 'fears', 0.7, "His faith broke when Strahd's curse took his son."),
  ].filter(Boolean) as Promise<unknown>[]);

  // 5) Legacy NPC rows — the v3 NPC screen reads `npcs.getAll` (this table).
  const npcs = [
    {
      name: 'Strahd von Zarovich', faction: 'Castle Ravenloft', role: 'Vampire Lord', status: 'alive',
      location: 'Castle Ravenloft', motivation: 'Possess Ireena Kolyana, the reincarnation of his lost love Tatyana.',
      secrets: 'Bound to Barovia by the Dark Powers; cannot truly leave. The Tarokka decides where his banes lie.',
      description: 'The land itself is an extension of his will — the mists, the weather, the despair.',
      personality: { traits: ['Patient', 'Cruel', 'Refined'], ideals: ['Possession'], bonds: ['Tatyana / Ireena'], flaws: ['Cannot let Tatyana go'] },
      tags: ['villain', 'undead', 'arc'], playerVisible: true,
    },
    {
      name: 'Ireena Kolyana', faction: 'Village of Barovia', role: 'Burgomaster\'s Ward', status: 'alive',
      location: 'Village of Barovia', motivation: 'Bury her adoptive father and escape Strahd\'s attention.',
      secrets: 'She is the latest reincarnation of Tatyana. Two puncture wounds already mark her neck.',
      description: 'Strong-willed and unafraid, though the dreams of Strahd grow harder to wake from.',
      personality: { traits: ['Brave', 'Stubborn'], ideals: ['Freedom'], bonds: ['Ismark'], flaws: ['Drawn to Strahd against her will'] },
      tags: ['ally', 'objective'], playerVisible: true,
    },
    {
      name: 'Ismark Kolyanovich', faction: 'Village of Barovia', role: 'Would-be Burgomaster', status: 'alive',
      location: 'Village of Barovia', motivation: 'Get Ireena to safety in Vallaki.',
      secrets: 'Knows the village is doomed but keeps up appearances to avoid panic.',
      description: 'Called "the Lesser" behind his back; a competent fighter and loyal brother.',
      personality: { traits: ['Loyal', 'Weary'], ideals: ['Family'], bonds: ['Ireena'], flaws: ['Drinks to cope'] },
      tags: ['ally'], playerVisible: true,
    },
    {
      name: 'Madam Eva', faction: 'Vistani', role: 'Seer', status: 'alive',
      location: 'Tser Pool Encampment', motivation: 'Set the hunt in motion; she has read this fate many times.',
      secrets: 'Rumored to be Strahd\'s own half-sister, ageless and bound to the Tarokka.',
      description: 'Her Tarokka reading determines where the artifacts, the ally, and Strahd\'s fate are found.',
      personality: { traits: ['Cryptic', 'Ancient'], ideals: ['Fate'], bonds: ['The Tarokka'], flaws: ['Speaks only in riddles'] },
      tags: ['neutral', 'quest-giver'], playerVisible: false,
    },
    {
      name: 'Donavich', faction: 'Village of Barovia', role: 'Priest', status: 'alive',
      location: 'Church of Barovia', motivation: 'Save his son\'s soul — or end his suffering.',
      secrets: 'His son Doru is a vampire spawn locked in the undercroft, still alive and screaming.',
      description: 'A man hollowed out by grief, his faith barely a flicker.',
      personality: { traits: ['Despairing', 'Devout'], ideals: ['Redemption'], bonds: ['Doru, his son'], flaws: ['Paralyzed by guilt'] },
      tags: ['ally', 'side-quest'], playerVisible: false,
    },
  ];
  await prisma.nPC.createMany({ data: npcs.map((n) => ({ ...n, campaignId: dst.id })) });
  console.log(`Created ${npcs.length} legacy NPCs`);

  // 6) Sessions with phases + routes (Sessions / run-sheet screen).
  const s1 = await prisma.gameSession.create({
    data: {
      campaignId: dst.id, sessionNumber: 1, title: 'Death House', status: 'completed',
      playerVisibility: 'public', prepStatus: 'complete',
      recap: 'The party answered two crying children outside a manor in the mists — and the house did not let them leave easily.',
    },
  });
  const s2 = await prisma.gameSession.create({
    data: {
      campaignId: dst.id, sessionNumber: 2, title: 'Into the Village of Barovia', status: 'planning',
      playerVisibility: 'dm-only', prepStatus: 'draft', activeSceneIndex: 0,
      quickNotes: 'Goal: deliver Ireena and Ismark a reason to trust the party; plant the Tarokka reading hook.',
    },
  });
  await prisma.sessionPhase.createMany({
    data: [
      { sessionId: s2.id, name: 'Arrival in the Mists', targetMinutes: 20, orderIndex: 0, notes: 'Read-aloud: the gates close behind them.' },
      { sessionId: s2.id, name: 'The Village of Barovia', targetMinutes: 45, orderIndex: 1, notes: 'Bildrath\'s, the church, the Kolyana home.' },
      { sessionId: s2.id, name: 'Tser Pool & Madam Eva', targetMinutes: 35, orderIndex: 2, notes: 'The Tarokka reading — roll the fates live.' },
    ],
  });
  await prisma.sessionRoute.createMany({
    data: [
      { sessionId: s2.id, name: 'Escort Ireena now', description: 'Leave for Vallaki immediately.', benefits: ['Builds trust fast'], risks: ['Leaves Donavich\'s quest unseen'], isActive: true, orderIndex: 0 },
      { sessionId: s2.id, name: 'Linger in the village', description: 'Investigate the church screaming first.', benefits: ['Doru side-quest', 'More lore'], risks: ['Strahd takes notice'], isActive: false, orderIndex: 1 },
    ],
  });
  console.log('Created 2 sessions (+ phases & routes)');

  // 6b) An ACTIVE encounter (the v3 combat tracker reads the campaign's active
  // encounter). Mixed party + threats, with live state that makes Heartflame fire
  // (a bloodied concentrator, a spent reaction).
  const enc = await prisma.encounter.create({
    data: { sessionId: s2.id, name: 'Ambush on the Old Svalich Road', status: 'active', round: 2 },
  });
  await prisma.encounterParticipant.createMany({
    data: [
      { encounterId: enc.id, name: 'Captain Arannis Vaelor', type: 'pc', initiative: 19, hp: 12, maxHp: 38, concentration: true },
      { encounterId: enc.id, name: 'Dragoth the Dreaded', type: 'pc', initiative: 16, hp: 47, maxHp: 52, reactionUsed: true },
      { encounterId: enc.id, name: 'Taelin Viziero', type: 'pc', initiative: 14, hp: 30, maxHp: 64 },
      { encounterId: enc.id, name: 'Dire Wolf', type: 'monster', initiative: 12, hp: 22, maxHp: 37, conditions: ['prone'] },
      { encounterId: enc.id, name: 'Dire Wolf (2)', type: 'monster', initiative: 8, hp: 37, maxHp: 37 },
      { encounterId: enc.id, name: 'Strahd von Zarovich', type: 'npc', initiative: 20, hp: 144, maxHp: 144 },
    ],
  });
  console.log('Created 1 active encounter (6 combatants)');

  // 7) Scenes / Theatre of the Mind (one presented → shows in the player lobby).
  await prisma.scene.createMany({
    data: [
      { campaignId: dst.id, title: 'The Mists Part', type: 'narration', orderIndex: 0, isPresented: true,
        description: 'The road behind you is gone — only fog, and the dim shapes of gallows-trees. Ahead, a village huddles under a sky the colour of a bruise.',
        dmNotes: 'Set tone. No mechanics yet — let the dread land.' },
      { campaignId: dst.id, title: 'Blood on the Old Svalich Road', type: 'exploration', orderIndex: 1, isPresented: false,
        description: 'Three dead bodies hang from a roadside gibbet. One of them is still warm.',
        dmNotes: 'Perception DC 12 reveals fresh tracks leading toward Tser Pool.' },
      { campaignId: dst.id, title: 'The Gates of Castle Ravenloft', type: 'set-piece', orderIndex: 2, isPresented: false,
        description: 'Two hundred feet of cliff and a portcullis of black iron. Something at a high window is watching you arrive.',
        dmNotes: 'Strahd is home. Decide now whether he greets them as host or hunter.' },
    ],
  });
  console.log('Created 3 scenes (1 presented)');

  // 8) Link the source homebrew item (Compendium screen).
  const srcHb = await prisma.campaignHomebrewContent.findMany({
    where: { campaignId: src.id },
    select: { homebrewId: true },
  });
  for (const h of srcHb) {
    await prisma.campaignHomebrewContent.create({ data: { campaignId: dst.id, homebrewId: h.homebrewId } });
  }
  console.log(`Linked ${srcHb.length} homebrew entries`);

  console.log(`\n✅ Done. Open: /v3/campaigns/${DST_SLUG}/overview  (player: /v3/play/${DST_SLUG})`);
}

main()
  .catch((e) => { console.error('SEED FAILED:', e?.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());
