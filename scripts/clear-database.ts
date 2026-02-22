/**
 * Clear Database (Keep Users)
 *
 * Safely deletes all data except User accounts.
 * Run with: npx tsx scripts/clear-database.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Clearing database (keeping users)...\n');

  try {
    // Delete in order to respect foreign key constraints

    // 1. Character-related join tables (new and legacy)
    console.log('Deleting character links...');
    await prisma.characterFeat.deleteMany();
    await prisma.characterSpell.deleteMany();
    await prisma.characterItem.deleteMany();
    await prisma.playerFeat.deleteMany();
    await prisma.playerSpell.deleteMany();
    await prisma.playerItem.deleteMany();

    // 2. Homebrew content and campaign links
    console.log('Deleting homebrew content...');
    await prisma.campaignHomebrewContent.deleteMany();
    await prisma.homebrewContent.deleteMany();
    await prisma.homebrewPDF.deleteMany();

    // 3. Session-related
    console.log('Deleting sessions and transcripts...');
    await prisma.sessionRecording.deleteMany();
    await prisma.transcriptionJob.deleteMany();
    await prisma.transcript.deleteMany();
    await prisma.gameSession.deleteMany();

    // 4. Campaign members, characters, and players
    console.log('Deleting characters, NPCs, and players...');
    await prisma.campaignCharacter.deleteMany();
    await prisma.character.deleteMany();
    await prisma.nPC.deleteMany();
    await prisma.player.deleteMany();

    // 5. Campaign invites and members
    console.log('Deleting campaign members and invites...');
    await prisma.campaignInvite.deleteMany();
    await prisma.campaignMember.deleteMany();

    // 6. Campaigns
    console.log('Deleting campaigns...');
    await prisma.campaign.deleteMany();

    // 7. Feedback
    console.log('Deleting feedback...');
    await prisma.feedback.deleteMany();

    // 8. Usage tracking and invites
    console.log('Deleting usage tracking and invites...');
    await prisma.userUsage.deleteMany();
    await prisma.inviteCode.deleteMany();

    // 9. User settings and sessions (but keep users)
    console.log('Deleting sessions and accounts...');
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();

    console.log('\n✅ Database cleared successfully!');
    console.log('👤 Users preserved');

    // Show remaining user count
    const userCount = await prisma.user.count();
    console.log(`📊 ${userCount} user(s) remaining\n`);

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
