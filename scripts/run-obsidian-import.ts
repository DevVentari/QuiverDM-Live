import dotenv from 'dotenv';
dotenv.config({ override: true });

import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from '@/lib/prisma';
import { generateUniqueSlug } from '@/lib/utils/slugify';
import { processJob } from '@/lib/queue/obsidian-import-process';

const VAULT_PATH = 'G:/My Drive/Notebooks/Dungeons and Dragons/Campaigns/Tales from The Bonfire Keep';
const USER_ID = 'cmm4mgdtr0001gjr7jn3fb00c';
const CAMPAIGN_NAME = 'Tales from The Bonfire Keep (v2)';

async function main() {
  console.log('[obsidian-import] Zipping vault...');

  const zip = new AdmZip();

  function addDir(dirPath: string, zipBase: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
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

  const slug = await generateUniqueSlug(CAMPAIGN_NAME, async (s) => {
    const existing = await prisma.campaign.findFirst({ where: { slug: s } });
    return !!existing;
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: CAMPAIGN_NAME,
      slug,
      userId: USER_ID,
      status: 'active',
    },
  });
  await prisma.campaignMember.create({
    data: { campaignId: campaign.id, userId: USER_ID, role: 'OWNER', canViewNPCSecrets: true },
  });
  console.log(`[obsidian-import] Campaign created: ${campaign.id} (${slug})`);

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
  console.log(`\n  Campaign: /campaigns/${slug}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
