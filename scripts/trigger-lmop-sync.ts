// Usage: npx tsx scripts/trigger-lmop-sync.ts
//
// Creates (or reuses) a dedicated "lmop-test" campaign and queues a DDB
// sourcebook sync against it for Lost Mine of Phandelver. The DDB workers
// on homelab LXC 206 will pick it up:
//   - worker-ddb-sync     → enumerates chapters, enqueues per-chapter jobs
//   - worker-ddb-chapter  → fetches each chapter, runs LLM extract, writes
//                           SourcebookEntity + WorldEntity rows
//   - worker-ddb-review   → post-processing
//
// Watch progress: query DdbSourcebook.syncStatus and SourcebookEntity count.

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { ddbSyncRepository } from '../src/server/repositories/ddb-sync.repository';
import { addDdbSyncJob } from '../src/lib/queue/ddb-sync-queue';

const prisma = new PrismaClient();
const OWNER_EMAIL = 'dev@blakewales.au';
const TEST_CAMPAIGN_SLUG = 'lmop-test';

async function main() {
  const owner = await prisma.user.findFirst({ where: { email: OWNER_EMAIL } });
  if (!owner) throw new Error(`No user with email ${OWNER_EMAIL}`);

  const entitlement = await prisma.ddbEntitlement.findFirst({
    where: { userId: owner.id, slug: 'lmop' },
  });
  if (!entitlement) {
    throw new Error('LMoP entitlement not found. Run scripts/refresh-ddb-entitlements.ts first.');
  }
  console.log(`[lmop-sync] entitlement: ${entitlement.title} (${entitlement.id})`);

  // Reuse an existing DdbSourcebook for LMoP if one is already on the books.
  const existingSourcebook = await prisma.ddbSourcebook.findFirst({
    where: { userId: owner.id, slug: 'lmop' },
  });

  let testCampaign = await prisma.campaign.findUnique({
    where: { slug: TEST_CAMPAIGN_SLUG },
    select: { id: true, name: true },
  });
  if (!testCampaign) {
    console.log(`[lmop-sync] creating ${TEST_CAMPAIGN_SLUG} campaign for sync target...`);
    const created = await prisma.campaign.create({
      data: {
        name: 'LMoP Test',
        slug: TEST_CAMPAIGN_SLUG,
        description: 'Throwaway campaign used to exercise the LMoP DDB sync.',
        userId: owner.id,
        status: 'active',
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
      select: { id: true, name: true },
    });
    testCampaign = created;
  }
  console.log(`[lmop-sync] target campaign: ${testCampaign.name} (${testCampaign.id})`);

  let sourcebookId: string;
  if (existingSourcebook) {
    sourcebookId = existingSourcebook.id;
    // Ensure the campaign is on the campaignIds array + CampaignSourcebook join.
    await prisma.ddbSourcebook.update({
      where: { id: sourcebookId },
      data: {
        campaignIds: Array.from(new Set([...existingSourcebook.campaignIds, testCampaign.id])),
      },
    });
    await ddbSyncRepository.linkSourcebookToCampaigns(sourcebookId, [testCampaign.id]);
    console.log(`[lmop-sync] reusing existing DdbSourcebook ${sourcebookId}`);
  } else {
    const created = await ddbSyncRepository.createSourcebook(
      owner.id,
      entitlement.id,
      entitlement.slug,
      entitlement.title,
      [testCampaign.id],
    );
    sourcebookId = created.id;
    console.log(`[lmop-sync] created DdbSourcebook ${sourcebookId}`);
  }

  console.log(`[lmop-sync] enqueueing sync job...`);
  await addDdbSyncJob(sourcebookId, owner.id);
  console.log(`[lmop-sync] job queued. Workers on LXC 206 will pick it up.`);
  console.log(`\nMonitor with:`);
  console.log(`  SELECT slug, "syncStatus", "lastSyncedAt" FROM "DdbSourcebook" WHERE slug='lmop';`);
  console.log(`  SELECT COUNT(*) FROM "SourcebookEntity" WHERE "sourcebookId"='${sourcebookId}';`);
  console.log(`  SELECT title, "syncStatus" FROM "DdbSourcebookChapter" WHERE "sourcebookId"='${sourcebookId}' ORDER BY "chapterIndex";`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
