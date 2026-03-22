/**
 * Seed a local PDF into QuiverDM production as a homebrew campaign PDF.
 * Uploads to R2, creates HomebrewPDF record, queues for processing.
 *
 * Run: npx tsx scripts/seed-pdf-campaign.ts
 */
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const REDIS_URL = 'rediss://default:AcIzAAIncDFmZGU0YzNhNGQzZTg0MTM0OTAzMzUyYjkyZjM2YWViMnAxNDk3MTU@concise-ram-49715.upstash.io:6379';

const R2_ACCOUNT_ID = 'f035ca1076a8341cfda39b5b9ee797f5';
const R2_ACCESS_KEY_ID = '284008e3bd8463b2d56b43445c6e8392';
const R2_SECRET_ACCESS_KEY = 'f06c630c0b668249511be2347d55a54794b7443be93a49292240d423ca890fff';
const R2_BUCKET_NAME = 'quiverdm';

const USER_ID = 'cmmqlqy1o0001co5m5wf4efj7'; // mail@blakewales.au
const CAMPAIGN_SLUG = 'year-of-rogue-dragons';

const PDF_PATH = 'c:/Users/mail/OneDrive/Documents/DriveThruRPG/Dungeon Masters Guild/Year Of Rogue Dragons/1493210-Year_Of_Rogue_Dragons.pdf';

const p = new PrismaClient({ datasources: { db: { url: DB } } });

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

(async () => {
  const campaign = await p.campaign.findFirst({ where: { slug: CAMPAIGN_SLUG }, select: { id: true, name: true } });
  if (!campaign) throw new Error(`Campaign not found: ${CAMPAIGN_SLUG}`);
  console.log(`Campaign: ${campaign.name} (${campaign.id})`);

  const filename = path.basename(PDF_PATH);
  const fileBuffer = fs.readFileSync(PDF_PATH);
  const fileSize = fileBuffer.length;
  console.log(`PDF: ${filename} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

  // Check if already seeded
  const existing = await p.homebrewPDF.findFirst({
    where: { userId: USER_ID, campaignId: campaign.id, filename },
    select: { id: true, processingStatus: true },
  });
  if (existing) {
    console.log(`Already seeded: ${existing.id} (${existing.processingStatus})`);
    await p.$disconnect();
    return;
  }

  // Upload to R2
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const r2Key = `homebrew-pdfs/${USER_ID}/${timestamp}-${sanitized}`;
  const r2Url = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Key}`;

  console.log('Uploading to R2...');
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: 'application/pdf',
    ContentLength: fileSize,
  }));
  console.log('Uploaded:', r2Key);

  // Create HomebrewPDF record
  const pdf = await p.homebrewPDF.create({
    data: {
      userId: USER_ID,
      campaignId: campaign.id,
      filename,
      fileSize,
      mimeType: 'application/pdf',
      r2Url,
      processingStatus: 'pending',
      useLLM: false,
    },
    select: { id: true },
  });
  console.log('Created HomebrewPDF:', pdf.id);

  // Queue processing job
  const url = new URL(REDIS_URL);
  const queue = new Queue('pdf-processing', {
    connection: {
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: decodeURIComponent(url.password),
      tls: {},
    },
  });

  await queue.add(`process-pdf-${pdf.id}`, {
    pdfId: pdf.id,
    userId: USER_ID,
    campaignId: campaign.id,
    r2Key,
    filename,
    options: { useLLM: false },
  }, { jobId: pdf.id });

  console.log('Queued for processing:', pdf.id);
  await queue.close();
  await p.$disconnect();
  console.log('\nDone. PDF will be processed by the pdf-processing worker on Hetzner.');
  console.log('Monitor: ssh root@204.168.157.125 \'docker exec quiverdm-workers tail -f /tmp/pdf-worker.log\'');
})().catch(e => { console.error(e); process.exit(1); });
