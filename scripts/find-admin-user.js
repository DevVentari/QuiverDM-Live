require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const query = process.argv[2] || '';

(async () => {
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      platformRole: true,
    },
    take: 20,
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
