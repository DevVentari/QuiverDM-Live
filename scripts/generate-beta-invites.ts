/**
 * Generate Beta Invite Codes
 *
 * Usage:
 *   npx tsx scripts/generate-beta-invites.ts --count 50
 *   npx tsx scripts/generate-beta-invites.ts --count 10 --expires 30
 */

import { inviteService } from '../src/server/services/invite.service';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let count = 10;
  let expiresInDays: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--expires' && args[i + 1]) {
      expiresInDays = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (isNaN(count) || count < 1 || count > 1000) {
    console.error('❌ Count must be between 1 and 1000');
    process.exit(1);
  }

  if (expiresInDays !== undefined && (isNaN(expiresInDays) || expiresInDays < 1)) {
    console.error('❌ Expiration days must be at least 1');
    process.exit(1);
  }

  console.log(`🎫 Generating ${count} invite code${count === 1 ? '' : 's'}...`);
  if (expiresInDays) {
    console.log(`⏰ Codes will expire in ${expiresInDays} day${expiresInDays === 1 ? '' : 's'}`);
  }

  try {
    const result = await inviteService.generateCodes(count, expiresInDays);

    console.log(`\n✅ Generated ${result.created} invite codes:\n`);

    // Print codes in a nice format
    result.codes.forEach((code, i) => {
      console.log(`  ${i + 1}. ${code}`);
    });

    console.log(`\n📊 Usage Stats:`);
    const stats = await inviteService.getStats();
    console.log(`  Total codes: ${stats.total}`);
    console.log(`  Used: ${stats.used}`);
    console.log(`  Unused: ${stats.unused}`);
    console.log(`  Expired: ${stats.expired}`);

    console.log(`\n✨ Done! Codes are ready for distribution.`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
