/**
 * Seed D&D Beyond books for production extraction.
 * Run: npx tsx scripts/seed-ddb-prod.ts
 *
 * Required env vars (or pass DATABASE_URL_PROD, REDIS_URL_PROD, DDB_COBALT_SESSION):
 *   DATABASE_URL_PROD  — unpooled Neon connection string
 *   REDIS_URL_PROD     — Upstash rediss:// URL
 *   DDB_COBALT_SESSION — raw CobaltSession cookie value
 *   DDB_USER_ID        — prod user ID to seed for
 *
 * Or set them in .env.local and this script will pick them up.
 *
 * Books: edit BOOKS array to add/remove titles.
 * Campaign linkage: set campaignIds per book (empty = book syncs without campaign context).
 */

import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const PROD_DB = process.env.DATABASE_URL_PROD;
const REDIS_URL = process.env.REDIS_URL_PROD;
const COBALT_SESSION = process.env.DDB_COBALT_SESSION;
const USER_ID = process.env.DDB_USER_ID;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'default-encryption-key-change-in-production';

if (!PROD_DB || !REDIS_URL || !COBALT_SESSION || !USER_ID) {
  console.error('Missing required env vars. Set DATABASE_URL_PROD, REDIS_URL_PROD, DDB_COBALT_SESSION, DDB_USER_ID.');
  process.exit(1);
}

// Edit this to add/remove books and campaign linkage
const BOOKS = [
  {
    slug: 'veor',
    title: 'Vecna: Eye of Ruin',
    coverImageUrl: 'https://www.dndbeyond.com/avatars/36103/283/638278697638346709.jpeg',
    sourceUrl: 'https://www.dndbeyond.com/sources/dnd/veor',
    campaignIds: (process.env.CAMPAIGN_VECNA ?? '').split(',').filter(Boolean),
  },
  {
    slug: 'idrotf',
    title: 'Icewind Dale: Rime of the Frostmaiden',
    coverImageUrl: 'https://www.dndbeyond.com/avatars/10350/883/637244675253140155.jpeg',
    sourceUrl: 'https://www.dndbeyond.com/sources/dnd/idrotf',
    campaignIds: (process.env.CAMPAIGN_ICEWIND ?? '').split(',').filter(Boolean),
  },
  {
    slug: 'lmop',
    title: 'Lost Mine of Phandelver',
    coverImageUrl: 'https://www.dndbeyond.com/avatars/10434/616/637248096401764265.jpeg',
    sourceUrl: 'https://www.dndbeyond.com/sources/lmop',
    campaignIds: (process.env.CAMPAIGN_PHANDELVER ?? '').split(',').filter(Boolean),
  },
  {
    slug: 'pbtso',
    title: 'Phandelver and Below: The Shattered Obelisk',
    coverImageUrl: 'https://www.dndbeyond.com/avatars/35214/280/638233891719898500.jpeg',
    sourceUrl: 'https://www.dndbeyond.com/sources/dnd/pbtso',
    campaignIds: (process.env.CAMPAIGN_PHANDELVER ?? '').split(',').filter(Boolean),
  },
];

function encrypt(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: PROD_DB } } });

  try {
    // Show campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { userId: USER_ID },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log('\nCampaigns for user:');
    for (const c of campaigns) console.log(`  ${c.id}  ${c.name}`);

    // Auto-find Phandelver campaigns if not specified via env
    const phandelverCampaigns = campaigns.filter(c =>
      c.name.toLowerCase().includes('phandelver') || c.name.toLowerCase().includes('phandle')
    );
    if (phandelverCampaigns.length > 0) {
      const ids = phandelverCampaigns.map(c => c.id);
      for (const book of BOOKS) {
        if ((book.slug === 'lmop' || book.slug === 'pbtso') && book.campaignIds.length === 0) {
          book.campaignIds = ids;
          console.log(`Auto-linked ${book.slug} to phandelver campaign(s): ${ids.join(', ')}`);
        }
      }
    }

    // Update CobaltSession
    const encryptedCobalt = encrypt(COBALT_SESSION!);
    await prisma.userSettings.upsert({
      where: { userId: USER_ID },
      update: { dndBeyondCobaltCookie: encryptedCobalt },
      create: { userId: USER_ID!, dndBeyondCobaltCookie: encryptedCobalt },
    });
    console.log(`\nUpdated CobaltSession for user ${USER_ID}`);

    // Upsert books
    const sourcebookIds: Record<string, string> = {};
    console.log('\nUpserting books:');

    for (const book of BOOKS) {
      const entitlement = await prisma.ddbEntitlement.upsert({
        where: { userId_slug: { userId: USER_ID!, slug: book.slug } },
        update: { title: book.title, coverImageUrl: book.coverImageUrl, sourceUrl: book.sourceUrl },
        create: {
          userId: USER_ID!,
          slug: book.slug,
          title: book.title,
          coverImageUrl: book.coverImageUrl,
          accessType: 'owned',
          sourceUrl: book.sourceUrl,
        },
      });

      const sourcebook = await prisma.ddbSourcebook.upsert({
        where: { userId_slug: { userId: USER_ID!, slug: book.slug } },
        update: { campaignIds: book.campaignIds, syncStatus: 'idle' },
        create: {
          userId: USER_ID!,
          entitlementId: entitlement.id,
          slug: book.slug,
          title: book.title,
          campaignIds: book.campaignIds,
          syncStatus: 'idle',
        },
      });

      sourcebookIds[book.slug] = sourcebook.id;
      console.log(`  ${book.slug}: sourcebook=${sourcebook.id} campaigns=[${book.campaignIds.join(', ') || 'none'}]`);
    }

    // Queue sync jobs
    const url = new URL(REDIS_URL!);
    const queue = new Queue('ddb-sourcebook-sync', {
      connection: {
        host: url.hostname,
        port: parseInt(url.port),
        username: url.username,
        password: decodeURIComponent(url.password),
        tls: {},
      },
    });

    console.log('\nQueuing sync jobs:');
    for (const book of BOOKS) {
      const sourcebookId = sourcebookIds[book.slug];
      const jobId = `sync-${sourcebookId}-${Date.now()}`;
      await queue.add(`sync-${sourcebookId}`, { sourcebookId, userId: USER_ID!, isUpdateCheck: false }, { jobId });
      console.log(`  ${book.slug} (${book.title}) — ${jobId}`);
    }

    await queue.close();
    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
