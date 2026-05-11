// Usage: npx tsx scripts/seed-mechanics-rotfm.ts <campaign-slug>
// Idempotent. Upserts the 17 RotFM character secrets into CampaignMechanic
// keyed by externalKey = 'rotfm.secret.{N}'. Re-running preserves any DM
// edits and any assignedToCharacterId / revealedAtSessionId state.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SecretSeed {
  externalKey: string;
  name: string;
  flavorText: string;
  hiddenTruth: string;
}

const SECRETS: SecretSeed[] = [
  { externalKey: 'rotfm.secret.1',  name: 'Reghed Survivor',     flavorText: 'You lost your family to a frost giant raid on your Reghed tribe.',                              hiddenTruth: 'You feel responsible — you ran when you should have fought, and a frost giant chieftain remembers your face.' },
  { externalKey: 'rotfm.secret.2',  name: 'Demon Slave',         flavorText: 'A demon hunts you. You don\'t remember its true name, only its glassy laughter.',              hiddenTruth: 'You were a fiend-blooded sorcerer; you bargained with the demon and broke the pact. It is coming to collect.' },
  { externalKey: 'rotfm.secret.3',  name: 'Apprehensive Auspex', flavorText: 'You\'ve seen visions of Ten-Towns burning and a frozen tower rising from the ice.',            hiddenTruth: 'Your visions come from Auril herself, who has marked you as a potential herald.' },
  { externalKey: 'rotfm.secret.4',  name: 'Sworn to Secrecy',    flavorText: 'You carry a relic stolen from an Arcane Brotherhood mage. They believe it lost.',              hiddenTruth: 'The relic is a phylactery shard. If broken, a long-imprisoned lich is freed.' },
  { externalKey: 'rotfm.secret.5',  name: 'Tomb-Tapper',         flavorText: 'You hear voices from underground when you sleep on bare stone.',                                hiddenTruth: 'You are descended from a Netherese line. Ythryn knows you are coming.' },
  { externalKey: 'rotfm.secret.6',  name: 'Lost Spawn',          flavorText: 'You were raised by humans but found as a baby on the ice. You don\'t know your origin.',       hiddenTruth: 'You are half-giant; your true mother was a stone giant exiled to Icewind Dale.' },
  { externalKey: 'rotfm.secret.7',  name: 'Spy',                 flavorText: 'The Zhentarim pay you to report on activity in Bryn Shander.',                                  hiddenTruth: 'Your handler in Luskan has been dead for weeks; someone else is sending you orders.' },
  { externalKey: 'rotfm.secret.8',  name: 'Cult Defector',       flavorText: 'You were once a low-ranking cultist of Auril. You renounced her in secret.',                    hiddenTruth: 'A cult sister you befriended is hunting you. She still loves Auril and hates that you turned away.' },
  { externalKey: 'rotfm.secret.9',  name: 'Estranged Family',    flavorText: 'You have a sibling somewhere in Ten-Towns. You haven\'t spoken in years.',                       hiddenTruth: 'Your sibling joined the Knights of the Black Sword and now serves the duergar.' },
  { externalKey: 'rotfm.secret.10', name: 'Witness',             flavorText: 'You saw something kill a friend in the Dale. You can\'t describe it; it had no shape.',         hiddenTruth: 'You witnessed a goliath child being abducted by a Chwinga, but your mind cannot accept it.' },
  { externalKey: 'rotfm.secret.11', name: 'Reincarnated',        flavorText: 'You have memories that aren\'t yours: a Reghed warrior\'s last battle, dying in snow.',         hiddenTruth: 'You are the reincarnation of a hero who fought the previous Everlasting Rime, 200 years ago.' },
  { externalKey: 'rotfm.secret.12', name: 'Hatched',             flavorText: 'You hatched from an egg. Your parents kept the shell hidden in the attic.',                     hiddenTruth: 'The egg was a hag\'s — you are a hag\'s daughter and the hag is waking up.' },
  { externalKey: 'rotfm.secret.13', name: 'Doppelgänger',        flavorText: 'You\'ve been told you have a twin you\'ve never met.',                                          hiddenTruth: 'Your "twin" is a doppelgänger who has been impersonating you in distant towns, accumulating crimes in your name.' },
  { externalKey: 'rotfm.secret.14', name: 'Wanted',              flavorText: 'A reward poster bearing your face is circulating in Luskan.',                                   hiddenTruth: 'The crime was real, but you don\'t remember committing it — a Blue Bear shaman planted false memories.' },
  { externalKey: 'rotfm.secret.15', name: 'Astral Sailor',       flavorText: 'A spelljammer crashed in Icewind Dale a decade ago. You were aboard.',                          hiddenTruth: 'You are not from this world. Your real name and life are on another sphere.' },
  { externalKey: 'rotfm.secret.16', name: 'Vampiric Threat',     flavorText: 'You wake at dusk and feel weakened by direct sunlight. You\'ve always been this way.',           hiddenTruth: 'You are a dhampir. Your sire still lives, and the cold of the Rime is slowing your full transformation.' },
  { externalKey: 'rotfm.secret.17', name: 'Wolf-Friend',         flavorText: 'A snowy white wolf has followed you for months. It will not approach others.',                   hiddenTruth: 'The wolf is a were-creature, your half-brother by an estranged father, and he is waiting for the right moment to reveal himself.' },
];

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/seed-mechanics-rotfm.ts <campaign-slug>');
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!campaign) {
    console.error(`No campaign found with slug "${slug}"`);
    process.exit(1);
  }

  console.log(`[seed-rotfm] Seeding ${SECRETS.length} secrets into "${campaign.name}" (${campaign.id})`);

  let created = 0, updated = 0;
  for (const s of SECRETS) {
    const existing = await prisma.campaignMechanic.findUnique({
      where: { campaignId_kind_externalKey: { campaignId: campaign.id, kind: 'secret', externalKey: s.externalKey } },
      select: { id: true },
    });
    const content: Prisma.JsonObject = { flavorText: s.flavorText, hiddenTruth: s.hiddenTruth };
    if (existing) {
      await prisma.campaignMechanic.update({
        where: { id: existing.id },
        data: { name: s.name, content },
      });
      updated++;
    } else {
      await prisma.campaignMechanic.create({
        data: {
          campaignId: campaign.id,
          kind: 'secret',
          sourcebook: 'rotfm',
          externalKey: s.externalKey,
          name: s.name,
          content,
        },
      });
      created++;
    }
  }

  console.log(`[seed-rotfm] Done. created=${created} updated=${updated}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
