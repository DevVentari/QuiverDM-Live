/**
 * Setup prod users for alpha test environment.
 * - Ensures mail@blakewales.au is MYTHKEEPER
 * - Creates david@test.local if missing
 * - Old test users remain but unused
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const p = new PrismaClient({ datasources: { db: { url: DB } } });

const TEST_PASSWORD = 'TestDM2026!';

const NEW_USERS = [
  { email: 'david@test.local', name: 'David Chen', platformRole: 'ADVENTURER' },
];

const ROLE_UPDATES = [
  { email: 'mail@blakewales.au', platformRole: 'MYTHKEEPER' },
];

(async () => {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const upd of ROLE_UPDATES) {
    const user = await p.user.findUnique({ where: { email: upd.email } });
    if (user) {
      await p.user.update({ where: { email: upd.email }, data: { platformRole: upd.platformRole as any } });
      console.log(`Updated ${upd.email} → ${upd.platformRole}`);
    }
  }

  for (const u of NEW_USERS) {
    const existing = await p.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await p.user.create({
        data: {
          email: u.email,
          name: u.name,
          platformRole: u.platformRole as any,
          accounts: {
            create: {
              type: 'credentials',
              provider: 'credentials',
              providerAccountId: u.email,
              password: hash,
            },
          },
        },
      });
      console.log(`Created ${u.email}`);
    } else {
      console.log(`Already exists: ${u.email}`);
    }
  }

  const users = await p.user.findMany({ select: { email: true, platformRole: true } });
  console.log('\nFinal users:');
  for (const u of users) console.log(`  ${u.email} (${u.platformRole})`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
