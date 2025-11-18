/**
 * Generate invite codes for QuiverDM
 *
 * Usage:
 *   npm run generate-invites -- 5           # Generate 5 codes
 *   npm run generate-invites -- 1 30        # Generate 1 code that expires in 30 days
 */

import { prisma } from '../src/server/db';
import { randomBytes } from 'crypto';

function generateInviteCode(): string {
  // Generate a random 8-character alphanumeric code
  return randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0] || '1', 10);
  const expiryDays = args[1] ? parseInt(args[1], 10) : null;

  console.log(`\n🎟️  Generating ${count} invite code(s)...\n`);

  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = generateInviteCode();
    const expiresAt = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const invite = await prisma.inviteCode.create({
      data: {
        code,
        expiresAt,
      },
    });

    codes.push(invite);

    console.log(`✅ Created: ${invite.code}`);
    if (invite.expiresAt) {
      console.log(`   Expires: ${invite.expiresAt.toLocaleDateString()}`);
    } else {
      console.log(`   Expires: Never`);
    }
    console.log('');
  }

  console.log(`\n📋 Summary:`);
  console.log(`   Total codes created: ${codes.length}`);
  console.log(`   Copy these codes and share with new users!\n`);

  // Print codes in a nice format for copying
  console.log('═'.repeat(50));
  codes.forEach((invite) => {
    console.log(`  ${invite.code}`);
  });
  console.log('═'.repeat(50));
}

main()
  .catch((error) => {
    console.error('\n❌ Error generating invite codes:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
