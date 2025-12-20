/**
 * Data Migration: Create CampaignMember records for existing campaigns
 *
 * This script migrates existing campaigns to the new multi-user system by:
 * 1. Finding all campaigns without any CampaignMember records
 * 2. Creating an OWNER CampaignMember for each campaign's userId
 *
 * Run with: npx ts-node scripts/migrate-campaign-members.ts
 * Or: npx tsx scripts/migrate-campaign-members.ts
 */

import { PrismaClient, CampaignRole } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCampaignMembers() {
  console.log('🚀 Starting campaign member migration...\n');

  // Find all campaigns
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      members: {
        select: { id: true },
      },
    },
  });

  console.log(`Found ${campaigns.length} campaigns to check\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  const errors: { campaignId: string; error: string }[] = [];

  for (const campaign of campaigns) {
    // Skip if campaign already has members
    if (campaign.members.length > 0) {
      console.log(`⏭️  Skipping "${campaign.name}" - already has ${campaign.members.length} member(s)`);
      skippedCount++;
      continue;
    }

    try {
      // Create OWNER membership for the campaign's userId
      await prisma.campaignMember.create({
        data: {
          campaignId: campaign.id,
          userId: campaign.userId,
          role: CampaignRole.OWNER,
          // OWNER has all permissions
          canViewNPCSecrets: true,
          canEditNPCs: true,
          canManageSessions: true,
          canInviteMembers: true,
        },
      });

      console.log(`✅ Migrated "${campaign.name}" - created OWNER membership`);
      migratedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to migrate "${campaign.name}": ${message}`);
      errors.push({ campaignId: campaign.id, error: message });
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   Total campaigns: ${campaigns.length}`);
  console.log(`   Migrated: ${migratedCount}`);
  console.log(`   Skipped (already had members): ${skippedCount}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const { campaignId, error } of errors) {
      console.log(`   Campaign ${campaignId}: ${error}`);
    }
  }

  console.log('\n✨ Migration complete!');
}

// Run the migration
migrateCampaignMembers()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
