import { PrismaClient } from '@prisma/client';
const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });
(async () => {
  const u = await p.user.findUnique({ where: { email: 'mail@blakewales.au' }, select: { id: true } });
  console.log('USER_ID:', u?.id);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
