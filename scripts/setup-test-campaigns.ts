/**
 * Create test campaigns for each persona and link sourcebooks.
 * Run: npx tsx scripts/setup-test-campaigns.ts
 *
 * Campaigns created:
 *   mail@blakewales.au  → "Year of Rogue Dragons" (all 4 sourcebooks)
 *   david@test.local    → "Lost Mine of Phandelver" (lmop + pbtso)
 *   jordan@test.local   → "Icewind Dale" (idrotf)
 *   chris@test.local    → "Vecna: Eve of Ruin" (veor)
 */
import { PrismaClient } from '@prisma/client';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });

async function getUser(email: string) {
  const user = await p.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

async function ensureCampaign(userId: string, name: string, slug: string, description: string) {
  const existing = await p.campaign.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  Already exists: ${name}`);
    return existing.id;
  }
  const campaign = await p.campaign.create({
    data: {
      name,
      slug,
      description,
      userId,
      members: {
        create: { userId, role: 'OWNER' },
      },
    },
    select: { id: true },
  });
  console.log(`  Created: ${name} (${campaign.id})`);
  return campaign.id;
}

(async () => {
  const mailId = await getUser('mail@blakewales.au');
  const davidId = await getUser('david@test.local');
  const jordanId = await getUser('jordan@test.local');
  const chrisId = await getUser('chris@test.local');

  console.log('Creating campaigns...');
  const mailCampaignId = await ensureCampaign(
    mailId,
    'Year of Rogue Dragons',
    'year-of-rogue-dragons',
    'A world-spanning campaign against the Cult of the Dragon. All sourcebooks loaded for DM Brain stress testing.'
  );
  const davidCampaignId = await ensureCampaign(
    davidId,
    'Lost Mine of Phandelver',
    'lost-mine-of-phandelver',
    'A classic starter adventure. Goblins, a lost mine, and the sinister Spider.'
  );
  const jordanCampaignId = await ensureCampaign(
    jordanId,
    'Icewind Dale',
    'icewind-dale',
    'A frozen wilderness haunted by Auril the Frostmaiden. Survival and mystery in Ten-Towns.'
  );
  const chrisCampaignId = await ensureCampaign(
    chrisId,
    'Vecna: Eve of Ruin',
    'vecna-eve-of-ruin',
    'A multiplanar epic to stop Vecna from unmaking the universe. High-stakes, high-drama storytelling.'
  );

  // Link sourcebooks to campaign IDs
  const sourcebooks = await p.ddbSourcebook.findMany({
    select: { id: true, slug: true, campaignIds: true },
  });

  const slugToCampaigns: Record<string, string[]> = {
    veor: [mailCampaignId, chrisCampaignId],
    idrotf: [mailCampaignId, jordanCampaignId],
    lmop: [mailCampaignId, davidCampaignId],
    pbtso: [mailCampaignId, davidCampaignId],
  };

  console.log('\nLinking sourcebooks to campaigns...');
  for (const sb of sourcebooks) {
    const newIds = slugToCampaigns[sb.slug] ?? [mailCampaignId];
    await p.ddbSourcebook.update({
      where: { id: sb.id },
      data: { campaignIds: newIds },
    });
    console.log(`  ${sb.slug} → [${newIds.join(', ')}]`);
  }

  console.log('\nDone. Re-run requeue-ddb-sync.ts to trigger entity extraction.');
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
