import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker, Job } from 'bullmq';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ObsidianImportJobData } from './obsidian-import-queue';
import {
  extractNpc,
  extractCharacter,
  extractSession,
  extractHomebrew,
} from '@/lib/ai/obsidian-extraction';

function getRedisConnection() {
  if (process.env.REDIS_URL) return { url: process.env.REDIS_URL, maxRetriesPerRequest: null };
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

function splitOnH2(content: string): string[] {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let pastFrontmatter = false;
  let inFrontmatter = false;

  for (const line of lines) {
    if (!pastFrontmatter && line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) pastFrontmatter = true;
      continue;
    }
    if (inFrontmatter) continue;

    if (line.startsWith('## ')) {
      if (current.length > 0) blocks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n').trim());
  return blocks.filter((b) => b.length > 50);
}

async function updateProgress(
  jobId: string,
  patch: Partial<{ total: number; done: number; currentFile: string; errors: string[] }>
) {
  const existing = await prisma.obsidianImportJob.findUnique({ where: { id: jobId }, select: { progress: true } });
  const prev = (existing?.progress as any) ?? { total: 0, done: 0, currentFile: '', errors: [] };
  await prisma.obsidianImportJob.update({
    where: { id: jobId },
    data: { progress: { ...prev, ...patch } },
  });
}

async function getUserGeminiKey(userId: string): Promise<string | undefined> {
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { geminiApiKey: true } });
  if (!settings?.geminiApiKey) return undefined;
  try {
    const { decrypt } = await import('@/lib/encryption');
    return decrypt(settings.geminiApiKey);
  } catch {
    return undefined;
  }
}

async function processJob(data: ObsidianImportJobData) {
  const { jobId, campaignId, userId, zipPath, options } = data;
  const errors: string[] = [];

  await prisma.obsidianImportJob.update({ where: { id: jobId }, data: { status: 'processing' } });

  const extractDir = path.join(path.dirname(zipPath), `obsidian-extract-${jobId}`);
  fs.mkdirSync(extractDir, { recursive: true });

  // Safe zip extraction — prevents path traversal (zip-slip)
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const resolvedExtractDir = path.resolve(extractDir);
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryPath = path.resolve(extractDir, entry.entryName);
    if (!entryPath.startsWith(resolvedExtractDir + path.sep)) {
      throw new Error(`Unsafe zip entry: ${entry.entryName}`);
    }
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, entry.getData());
  }

  const geminiKey = await getUserGeminiKey(userId);

  function walkDir(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkDir(full));
      else if (entry.name.endsWith('.md')) results.push(full);
    }
    return results;
  }

  const allFiles = walkDir(extractDir);

  type FileCategory =
    | 'npc'
    | 'character'
    | 'session-planning'
    | 'session-completed'
    | 'homebrew-item'
    | 'homebrew-location'
    | 'homebrew-faction'
    | 'homebrew-race'
    | 'homebrew-rule'
    | 'skip';

  function categorize(filePath: string): FileCategory {
    const rel = path.relative(extractDir, filePath).replace(/\\/g, '/').toLowerCase();
    if (rel.includes('player characters/') || rel.includes('player-characters/')) return 'character';
    if (rel.includes('sessions/')) return 'session-completed';
    if (rel.includes('adventures/')) return 'session-planning';
    const base = path.basename(filePath).toLowerCase();
    if (base === 'npcs.md') return 'npc';
    if (base === 'items.md') return 'homebrew-item';
    if (base === 'locations.md') return 'homebrew-location';
    if (base === 'factions.md') return 'homebrew-faction';
    if (base === 'races.md') return 'homebrew-race';
    if (base === 'systems.md') return 'homebrew-rule';
    return 'skip';
  }

  type WorkItem = { category: FileCategory; label: string; markdown: string };
  const workItems: WorkItem[] = [];

  for (const filePath of allFiles) {
    const category = categorize(filePath);
    if (category === 'skip') continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const label = path.basename(filePath, '.md');

    if (
      ['npc', 'homebrew-item', 'homebrew-location', 'homebrew-faction', 'homebrew-race', 'homebrew-rule'].includes(
        category
      )
    ) {
      const blocks = splitOnH2(content);
      for (const block of blocks) {
        const name = block.split('\n')[0].replace(/^##\s*/, '').trim();
        workItems.push({ category, label: name, markdown: block });
      }
    } else {
      workItems.push({ category, label, markdown: content });
    }
  }

  await updateProgress(jobId, { total: workItems.length, done: 0, currentFile: '', errors: [] });

  let done = 0;

  for (const item of workItems) {
    await updateProgress(jobId, { currentFile: `${item.label} (${item.category})`, done });

    try {
      if (item.category === 'npc' && options.npcs) {
        const extracted = await extractNpc(item.markdown, geminiKey);
        await prisma.nPC.create({
          data: {
            campaignId,
            name: extracted.name || item.label,
            description: extracted.description,
            faction: extracted.faction,
            role: extracted.role,
            secrets: extracted.secrets,
            stats: (extracted.stats ?? {}) as Prisma.InputJsonValue,
            tags: extracted.tags ?? [],
          },
        });
      } else if (item.category === 'character' && options.characters) {
        const extracted = await extractCharacter(item.markdown, geminiKey);
        const char = await prisma.character.create({
          data: {
            userId,
            name: extracted.name || item.label,
            race: extracted.race,
            class: extracted.class,
            level: extracted.level || 1,
            abilityScores: (extracted.abilityScores ?? {}) as Prisma.InputJsonValue,
            hitPoints: (extracted.hitPoints ?? { current: 0, max: 0, temp: 0 }) as Prisma.InputJsonValue,
            armorClass: extracted.armorClass,
            backstory: extracted.backstory,
            personalityTraits: extracted.personalityTraits,
            ideals: extracted.ideals,
            bonds: extracted.bonds,
            flaws: extracted.flaws,
          },
        });
        await prisma.campaignCharacter.create({
          data: { campaignId, characterId: char.id, status: 'ACTIVE' },
        });
      } else if (item.category === 'session-planning' && options.sessions) {
        const extracted = await extractSession(item.markdown, 'planning', geminiKey);
        let sessionNumber = extracted.sessionNumber;
        if (!sessionNumber) {
          const maxRow = await prisma.gameSession.aggregate({
            where: { campaignId },
            _max: { sessionNumber: true },
          });
          sessionNumber = (maxRow._max.sessionNumber ?? 0) + 1;
        }
        await prisma.gameSession.create({
          data: {
            campaignId,
            title: extracted.title || item.label,
            sessionNumber,
            date: extracted.date ? new Date(extracted.date) : new Date(),
            status: 'planning',
            prepStatus: 'complete',
            prepData: (extracted.prepData ?? {}) as Prisma.InputJsonValue,
          },
        });
      } else if (item.category === 'session-completed' && options.sessions) {
        const extracted = await extractSession(item.markdown, 'completed', geminiKey);
        let sessionNumber = extracted.sessionNumber;
        if (!sessionNumber) {
          const maxRow = await prisma.gameSession.aggregate({
            where: { campaignId },
            _max: { sessionNumber: true },
          });
          sessionNumber = (maxRow._max.sessionNumber ?? 0) + 1;
        }
        await prisma.gameSession.create({
          data: {
            campaignId,
            title: extracted.title || item.label,
            sessionNumber,
            date: extracted.date ? new Date(extracted.date) : new Date(),
            status: 'completed',
            quickNotes: extracted.quickNotes,
          },
        });
      } else if (item.category.startsWith('homebrew-') && options.homebrew) {
        const typeMap: Record<string, string> = {
          'homebrew-item': 'item',
          'homebrew-location': 'location',
          'homebrew-faction': 'faction',
          'homebrew-race': 'race',
          'homebrew-rule': 'rule',
        };
        const contentType = typeMap[item.category] ?? 'item';
        const extracted = await extractHomebrew(item.markdown, contentType, geminiKey);
        const content = await prisma.homebrewContent.create({
          data: {
            userId,
            type: contentType,
            name: extracted.name || item.label,
            data: { description: extracted.description, ...(extracted.properties ?? {}) } as Prisma.InputJsonValue,
            images: [],
            tags: [contentType],
            searchText: `${extracted.name} ${extracted.description}`,
            sourceType: 'obsidian_import',
          },
        });
        await prisma.campaignHomebrewContent.create({
          data: { campaignId, homebrewId: content.id },
        });
      }
    } catch (err: unknown) {
      errors.push(`${item.label}: ${err instanceof Error ? err.message : String(err)}`);
    }

    done++;
  }

  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
  } catch {}

  await prisma.obsidianImportJob.update({
    where: { id: jobId },
    data: {
      status: 'done',
      progress: { total: workItems.length, done, currentFile: '', errors } as Prisma.InputJsonValue,
    },
  });
}

const worker = new Worker<ObsidianImportJobData>(
  'obsidian-import',
  async (job: Job<ObsidianImportJobData>) => {
    await processJob(job.data);
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('failed', async (job, err) => {
  if (job) {
    await prisma.obsidianImportJob
      .update({
        where: { id: job.data.jobId },
        data: {
          status: 'error',
          progress: { total: 0, done: 0, currentFile: '', errors: [err.message] } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {});
  }
  console.error('[obsidian-import] job failed:', err);
});

console.log('[obsidian-import-worker] listening...');
