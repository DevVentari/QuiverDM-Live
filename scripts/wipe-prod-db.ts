/**
 * Wipe all game data from prod DB, keeping User/Account/Session tables.
 * Run: DATABASE_URL_PROD=... npx tsx scripts/wipe-prod-db.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROD_DB = process.env.DATABASE_URL_PROD;
if (!PROD_DB) { console.error('Missing DATABASE_URL_PROD'); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url: PROD_DB } } });

async function main() {
  // Order matters for FK constraints
  await prisma.worldRelationship.deleteMany({});
  console.log('wiped WorldRelationship');

  await prisma.worldStateChange.deleteMany({});
  console.log('wiped WorldStateChange');

  await prisma.worldEntity.deleteMany({});
  console.log('wiped WorldEntity');

  await prisma.encounterPlan.deleteMany({});
  console.log('wiped EncounterPlan');

  // Sessions and content
  try { await (prisma as any).sessionTranscription.deleteMany({}); console.log('wiped SessionTranscription'); } catch(e) { console.log('skip SessionTranscription'); }
  try { await (prisma as any).sessionRecording.deleteMany({}); console.log('wiped SessionRecording'); } catch(e) { console.log('skip SessionRecording'); }
  try { await (prisma as any).sessionSummary.deleteMany({}); console.log('wiped SessionSummary'); } catch(e) { console.log('skip SessionSummary'); }
  try { await (prisma as any).playerRecap.deleteMany({}); console.log('wiped PlayerRecap'); } catch(e) { console.log('skip PlayerRecap'); }
  await prisma.session.deleteMany({});
  console.log('wiped Session (campaigns)');

  // DDB
  await prisma.ddbSourcebookChapter.deleteMany({});
  console.log('wiped DdbSourcebookChapter');
  await prisma.ddbSourcebook.deleteMany({});
  console.log('wiped DdbSourcebook');
  await prisma.ddbEntitlement.deleteMany({});
  console.log('wiped DdbEntitlement');

  // Homebrew
  try { await (prisma as any).homebrewExtraction.deleteMany({}); console.log('wiped HomebrewExtraction'); } catch(e) { console.log('skip HomebrewExtraction'); }
  await prisma.homebrewContent.deleteMany({});
  console.log('wiped HomebrewContent');

  // NPCs and characters
  await prisma.nPC.deleteMany({});
  console.log('wiped NPC');
  try { await (prisma as any).character.deleteMany({}); console.log('wiped Character'); } catch(e) { console.log('skip Character'); }

  // Campaigns
  await prisma.campaignMember.deleteMany({});
  console.log('wiped CampaignMember');
  try { await (prisma as any).campaignInvite.deleteMany({}); console.log('wiped CampaignInvite'); } catch(e) { console.log('skip CampaignInvite'); }
  await prisma.campaign.deleteMany({});
  console.log('wiped Campaign');

  // Other
  try { await (prisma as any).apiUsageLog.deleteMany({}); console.log('wiped ApiUsageLog'); } catch(e) { console.log('skip ApiUsageLog'); }
  try { await (prisma as any).webhookEndpoint.deleteMany({}); console.log('wiped WebhookEndpoint'); } catch(e) { console.log('skip WebhookEndpoint'); }
  try { await (prisma as any).stripeCustomer.deleteMany({}); console.log('wiped StripeCustomer'); } catch(e) { console.log('skip StripeCustomer'); }
  try { await (prisma as any).feedback.deleteMany({}); console.log('wiped Feedback'); } catch(e) { console.log('skip Feedback'); }
  await prisma.userSettings.deleteMany({});
  console.log('wiped UserSettings');

  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('\nRemaining users:');
  for (const u of users) console.log(`  ${u.email} (${u.role})`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
