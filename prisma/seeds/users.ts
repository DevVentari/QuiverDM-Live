import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  const hashedPassword = await hash('demo1234', 12);

  const dm = await prisma.user.upsert({
    where: { email: 'demo@quiverdm.com' },
    update: {},
    create: { email: 'demo@quiverdm.com', name: 'Demo DM', onboardingCompleted: true },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: dm.email! } },
    update: {},
    create: {
      userId: dm.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: dm.email!,
      password: hashedPassword,
    },
  });

  const player = await prisma.user.upsert({
    where: { email: 'player@quiverdm.com' },
    update: {},
    create: { email: 'player@quiverdm.com', name: 'Demo Player', onboardingCompleted: true },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: player.email! } },
    update: {},
    create: {
      userId: player.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: player.email!,
      password: hashedPassword,
    },
  });

  console.log(`Created demo users: ${dm.email}, ${player.email}`);
  return { dm, player };
}
