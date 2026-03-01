import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/server/db';
import * as campaignRepository from '@/server/repositories/campaign.repository';
import { addObsidianImportJob } from '@/lib/queue/obsidian-import-queue';
import { generateUniqueSlug } from '@/lib/utils/slugify';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const campaignName = (formData.get('name') as string | null)?.trim();
    const description = (formData.get('description') as string | null)?.trim() || undefined;

    const npcs = formData.get('npcs') !== 'false';
    const sessions = formData.get('sessions') !== 'false';
    const characters = formData.get('characters') !== 'false';
    const homebrew = formData.get('homebrew') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!campaignName) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate ZIP magic bytes (PK\x03\x04)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      return NextResponse.json({ error: 'File must be a valid ZIP archive' }, { status: 400 });
    }

    // Create campaign + owner membership
    const slug = await generateUniqueSlug(campaignName, async (s) => {
      const existing = await prisma.campaign.findFirst({ where: { slug: s } });
      return !!existing;
    });
    const campaign = await campaignRepository.create({ name: campaignName, slug, description, userId });

    // Create import job record (zipPath filled in after writing file)
    const job = await prisma.obsidianImportJob.create({
      data: {
        campaignId: campaign.id,
        userId,
        zipPath: '',
        options: { npcs, sessions, characters, homebrew },
        status: 'pending',
      },
    });

    // Save zip to temp dir
    const zipPath = path.join(os.tmpdir(), `obsidian-${job.id}.zip`);
    await fs.writeFile(zipPath, buffer);

    await prisma.obsidianImportJob.update({ where: { id: job.id }, data: { zipPath } });

    await addObsidianImportJob({
      jobId: job.id,
      campaignId: campaign.id,
      userId,
      zipPath,
      options: { npcs, sessions, characters, homebrew },
    });

    return NextResponse.json({ jobId: job.id, campaignId: campaign.id, campaignSlug: campaign.slug });
  } catch (error: any) {
    console.error('[obsidian-vault upload] error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
