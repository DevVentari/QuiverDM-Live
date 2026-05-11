require('dotenv/config');

const { PrismaClient, PlatformRole } = require('@prisma/client');

const prisma = new PrismaClient();

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promote-admin-user.js <email>');
  process.exit(1);
}

(async () => {
  const updated = await prisma.user.update({
    where: { email },
    data: { platformRole: PlatformRole.MYTHKEEPER },
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      platformRole: true,
    },
  });

  console.log(JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
