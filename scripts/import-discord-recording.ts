/**
 * One-shot script: import a Craig-bot Discord multi-track recording into QuiverDM.
 *
 * Usage:
 *   npx tsx scripts/import-discord-recording.ts \
 *     --dir "docs/Jordan-New-Campaign" \
 *     --campaign-name "Jordan's Campaign" \
 *     --campaign-slug "jordans-campaign" \
 *     --session-title "Session 0" \
 *     --session-number 0 \
 *     --owner-email "blake.wales.au@gmail.com"
 *
 * What it does:
 *   1. Finds (or creates) the Campaign + adds owner as OWNER member
 *   2. Creates a GameSession (status: completed)
 *   3. Uploads each *.flac from the directory to R2 under session-recordings/
 *   4. Creates SessionRecording rows with speakerTag extracted from filenames
 *   5. Enqueues a multi-track job — the worker transcribes + merges + writes Transcript
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { parseArgs } from 'node:util';
import { prisma } from '../src/lib/prisma';
import { uploadToR2 } from '../src/lib/storage/r2';
import { randomUUID } from 'crypto';

const { values: args } = parseArgs({
  options: {
    dir:             { type: 'string' },
    'campaign-name': { type: 'string' },
    'campaign-slug': { type: 'string' },
    'session-title': { type: 'string', default: 'Session 0' },
    'session-number':{ type: 'string', default: '0' },
    'owner-email':   { type: 'string', default: 'blake.wales.au@gmail.com' },
  },
});

const dir           = args['dir']!;
const campaignName  = args['campaign-name']!;
const campaignSlug  = args['campaign-slug']!;
const sessionTitle  = args['session-title']!;
const sessionNumber = parseInt(args['session-number']!, 10);
const ownerEmail    = args['owner-email']!;

if (!dir || !campaignName || !campaignSlug) {
  console.error('--dir, --campaign-name, and --campaign-slug are required');
  process.exit(1);
}

// Extract speaker tag from Craig-bot filenames like "1-thechunk_.flac" → "thechunk"
function speakerTagFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  // Strip leading "N-" index
  const stripped = base.replace(/^\d+-/, '');
  // Remove trailing underscores/spaces
  return stripped.replace(/[_\s]+$/, '');
}

async function main() {
  // 1. Owner user
  const owner = await prisma.user.findFirst({ where: { email: ownerEmail } });
  if (!owner) throw new Error(`User not found: ${ownerEmail}`);
  console.log(`Owner: ${owner.name} (${owner.id})`);

  // 2. Campaign — upsert
  let campaign = await prisma.campaign.findUnique({ where: { slug: campaignSlug } });
  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        name:   campaignName,
        slug:   campaignSlug,
        userId: owner.id,
        status: 'active',
      },
    });
    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId:     owner.id,
        role:       'OWNER',
      },
    });
    console.log(`Created campaign: ${campaign.id}`);
  } else {
    console.log(`Using existing campaign: ${campaign.id}`);
  }

  // 3. GameSession — find or create
  let session = await prisma.gameSession.findUnique({
    where: { campaignId_sessionNumber: { campaignId: campaign.id, sessionNumber } },
  });
  if (!session) {
    session = await prisma.gameSession.create({
      data: {
        campaignId:    campaign.id,
        sessionNumber,
        title:         sessionTitle,
        status:        'completed',
        date:          new Date('2026-05-16T09:22:10.011Z'),
      },
    });
    console.log(`Created session: ${session.id}`);
  } else {
    console.log(`Using existing session: ${session.id}`);
  }

  // 4. Find FLAC files
  const entries = await fs.readdir(dir);
  const flacs   = entries.filter(f => f.toLowerCase().endsWith('.flac')).sort();
  if (flacs.length === 0) throw new Error(`No .flac files found in ${dir}`);
  console.log(`Found ${flacs.length} FLAC tracks: ${flacs.join(', ')}`);

  // 5. Upload + create SessionRecording rows
  const uploadGroupId = randomUUID();
  const recordings: { id: string; speakerTag: string }[] = [];

  for (const filename of flacs) {
    const filePath   = path.resolve(dir, filename);
    const data       = await fs.readFile(filePath);
    const fileSize   = data.length;
    const speakerTag = speakerTagFromFilename(filename);
    const r2Key      = `session-recordings/${owner.id}/${campaign.id}/${Date.now()}-${filename}`;

    process.stdout.write(`Uploading ${filename} (${(fileSize / 1024 / 1024).toFixed(1)} MB) ...`);
    await uploadToR2({ key: r2Key, body: data, contentType: 'audio/flac' });
    console.log(' done');

    const rec = await prisma.sessionRecording.create({
      data: {
        sessionId:       session.id,
        type:            'audio',
        originalUrl:     `/api/storage/${r2Key}`,
        fileSize,
        isMultiTrack:    true,
        uploadGroupId,
        speakerTag,
        processingStatus: 'queued',
        mergeStatus:     'pending',
      },
    });
    recordings.push({ id: rec.id, speakerTag });
    console.log(`  → Recording ${rec.id} | speaker: ${speakerTag}`);
  }

  // 6. Enqueue multi-track job (lazy import to avoid early Redis connection)
  const { addMultiTrackJob } = await import('../src/lib/queue/multi-track-queue');
  const job = await addMultiTrackJob({ uploadGroupId, sessionId: session.id, campaignId: campaign.id });
  console.log(`\nEnqueued multi-track job: ${job.id}`);
  console.log(`Campaign: /campaigns/${campaign.slug}`);
  console.log(`Session:  /campaigns/${campaign.slug}/sessions (session #${sessionNumber})`);
  console.log('\nThe worker will transcribe each track via AssemblyAI, merge by timestamp,');
  console.log('and write a speaker-labeled Transcript — then trigger context extraction + cleanup.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
