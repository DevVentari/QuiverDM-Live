import dotenv from 'dotenv';
dotenv.config(); // don't override env vars passed on the command line

import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from '@/lib/prisma';
import { generateUniqueSlug } from '@/lib/utils/slugify';
import { processJob } from '@/lib/queue/obsidian-import-process';

const VAULT_PATH = 'G:/My Drive/Notebooks/Dungeons and Dragons/Campaigns/Tales from The Bonfire Keep';
const USER_ID = 'cmm4mgdtr0001gjr7jn3fb00c';
const CAMPAIGN_NAME = 'Tales from The Bonfire Keep';
// Set to an existing campaign ID to reuse it instead of creating a new one
const EXISTING_CAMPAIGN_ID: string | null = null;

async function main() {
  console.log('[obsidian-import] Zipping vault...');

  const zip = new AdmZip();

  const SKIP_DIRS = new Set(['Adventures', '.obsidian', '.trash', '.kiro']);

  function addDir(dirPath: string, zipBase: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        addDir(fullPath, path.join(zipBase, entry.name));
      } else if (entry.name.endsWith('.md')) {
        zip.addFile(
          path.join(zipBase, entry.name).replace(/\\/g, '/'),
          fs.readFileSync(fullPath)
        );
      }
    }
  }

  addDir(VAULT_PATH, '');

  const zipPath = path.join(os.tmpdir(), `obsidian-import-${Date.now()}.zip`).replace(/\\/g, '/');
  zip.writeZip(zipPath);
  console.log(`[obsidian-import] ZIP written to ${zipPath}`);

  let campaign: { id: string; slug: string };
  if (EXISTING_CAMPAIGN_ID) {
    const found = await prisma.campaign.findUnique({ where: { id: EXISTING_CAMPAIGN_ID } });
    if (!found) throw new Error(`Campaign ${EXISTING_CAMPAIGN_ID} not found`);
    campaign = found;
    console.log(`[obsidian-import] Using existing campaign: ${campaign.id} (${campaign.slug})`);
  } else {
    const slug = await generateUniqueSlug(CAMPAIGN_NAME, async (s) => {
      const existing = await prisma.campaign.findFirst({ where: { slug: s } });
      return !!existing;
    });
    campaign = await prisma.campaign.create({
      data: { name: CAMPAIGN_NAME, slug, userId: USER_ID, status: 'active' },
    });
    await prisma.campaignMember.create({
      data: { campaignId: campaign.id, userId: USER_ID, role: 'OWNER', canViewNPCSecrets: true },
    });
    console.log(`[obsidian-import] Campaign created: ${campaign.id} (${campaign.slug})`);
  }

  const job = await prisma.obsidianImportJob.create({
    data: {
      campaignId: campaign.id,
      userId: USER_ID,
      zipPath,
      options: { npcs: true, sessions: true, characters: true, homebrew: true },
      status: 'pending',
    },
  });
  console.log(`[obsidian-import] Job created: ${job.id}`);
  console.log('[obsidian-import] Processing...');

  await processJob({
    jobId: job.id,
    campaignId: campaign.id,
    userId: USER_ID,
    zipPath,
    options: { npcs: true, sessions: true, characters: true, homebrew: true },
  });

  const result = await prisma.obsidianImportJob.findUnique({ where: { id: job.id } });
  const progress = result?.progress as any;
  console.log(`\n[obsidian-import] DONE`);
  console.log(`  Total: ${progress?.total}`);
  console.log(`  Done:  ${progress?.done}`);
  console.log(`  Errors: ${progress?.errors?.length ?? 0}`);
  if (progress?.errors?.length > 0) {
    console.log('  First 5 errors:');
    (progress.errors as string[]).slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
  console.log(`\n  Campaign: /campaigns/${campaign.slug}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
