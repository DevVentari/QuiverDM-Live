/**
 * Database cleanup script - Remove all old PDF entries
 * Run this before implementing Marker integration
 */

import { prisma } from '../src/server/db';

async function main() {
  console.log('🗑️  Database Cleanup Script\n');
  console.log('═'.repeat(60));

  const campaignId = 'cmhsbpbhd0002ia54fik2pwvb';

  // Count existing records
  const pdfCount = await prisma.homebrewPDF.count({
    where: { campaignId },
  });

  // Count homebrew content linked to this campaign
  const contentCount = await prisma.campaignHomebrewContent.count({
    where: {
      campaignId,
    },
  });

  console.log(`\n📊 Current Database State:`);
  console.log(`   PDFs: ${pdfCount}`);
  console.log(`   Homebrew Content: ${contentCount}`);

  if (pdfCount === 0) {
    console.log('\n✅ Database is already clean!');
    return;
  }

  // Confirm deletion
  console.log(`\n⚠️  This will DELETE:`);
  console.log(`   - ${pdfCount} PDF records`);
  console.log(`   - ${contentCount} homebrew content records`);
  console.log(`   - Associated campaign links\n`);

  // Delete in correct order (respect foreign keys)
  console.log('🗑️  Deleting records...\n');

  // 1. Delete campaign-homebrew links
  const campaignLinksDeleted = await prisma.campaignHomebrewContent.deleteMany({
    where: {
      campaignId,
    },
  });
  console.log(`✅ Deleted ${campaignLinksDeleted.count} campaign-homebrew links`);

  // 2. Delete homebrew content (via join table - actual content is owned by user)
  // Note: CampaignHomebrewContent deletion above already handles this
  console.log(`✅ Campaign-homebrew links deleted (content remains in user library)`);

  // 3. Delete PDFs
  const pdfsDeleted = await prisma.homebrewPDF.deleteMany({
    where: { campaignId },
  });
  console.log(`✅ Deleted ${pdfsDeleted.count} PDF records`);

  // Verify cleanup
  const remainingPDFs = await prisma.homebrewPDF.count({
    where: { campaignId },
  });

  const remainingContent = await prisma.campaignHomebrewContent.count({
    where: {
      campaignId,
    },
  });

  console.log(`\n📊 Final Database State:`);
  console.log(`   PDFs: ${remainingPDFs}`);
  console.log(`   Homebrew Content: ${remainingContent}`);

  if (remainingPDFs === 0 && remainingContent === 0) {
    console.log(`\n✅ Database cleanup complete! Ready for Marker integration.`);
  } else {
    console.log(`\n⚠️  Warning: Some records remain. Manual cleanup may be needed.`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('💡 Note: R2 storage files were NOT deleted.');
  console.log('   You can manually clean them up later if needed.');
}

main()
  .catch((error) => {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
