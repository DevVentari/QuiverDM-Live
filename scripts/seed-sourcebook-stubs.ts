import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: [] });

const BOOKS = [
  { slug: 'idrotf', title: 'Icewind Dale: Rime of the Frostmaiden' },
  { slug: 'wdh',   title: 'Waterdeep: Dragon Heist' },
  { slug: 'toa',   title: 'Tomb of Annihilation' },
  { slug: 'bgdia', title: "Baldur's Gate: Descent into Avernus" },
];

const USER_ID = 'cmp2jbjre02hq1f9kqbz4aary';

async function main() {
  for (const book of BOOKS) {
    const sourceUrl = `https://www.dndbeyond.com/sources/dnd/${book.slug}`;

    const existing = await prisma.ddbSourcebook.findFirst({ where: { slug: book.slug } });
    if (existing) {
      console.log(`skip  ${book.slug} (already exists)`);
      continue;
    }

    const entitlement = await prisma.ddbEntitlement.upsert({
      where: { userId_slug: { userId: USER_ID, slug: book.slug } },
      create: { userId: USER_ID, slug: book.slug, title: book.title, sourceUrl, accessType: 'owned' },
      update: {},
    });

    await prisma.ddbSourcebook.create({
      data: {
        userId: USER_ID,
        entitlementId: entitlement.id,
        slug: book.slug,
        title: book.title,
        syncStatus: 'idle',
      },
    });

    console.log(`seeded ${book.slug} — ${book.title}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
