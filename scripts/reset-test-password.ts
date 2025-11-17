/**
 * Reset test user password
 * Sets dev@blakewales.au password to: xaub6NaM7468
 */

import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'dev@blakewales.au';
  const password = 'xaub6NaM7468';

  console.log(`🔐 Resetting password for: ${email}`);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User not found. Creating new user...');

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: 'Blake',
        emailVerified: new Date(),
      },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create credentials account
    await prisma.account.create({
      data: {
        userId: newUser.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: newUser.id,
        password: hashedPassword,
      },
    });

    console.log('✅ User created with password');
  } else {
    console.log('✅ User found');

    // Find or create credentials account
    let account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'credentials',
      },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!account) {
      console.log('Creating credentials account...');
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: user.id,
          password: hashedPassword,
        },
      });
    } else {
      console.log('Updating password...');
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });
    }

    console.log('✅ Password updated');
  }

  console.log(`\n✅ Test user ready:`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
