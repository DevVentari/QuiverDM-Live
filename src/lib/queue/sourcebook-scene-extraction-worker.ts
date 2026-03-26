import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Worker } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '../prisma';
import type { SourcebookSceneExtractionJobData, SourcebookSceneExtractionJobResult } from './sourcebook-scene-extraction-queue';

// ─── Markdown parsing helpers ───────────────────────────────────────────────

const CHAPTER_RE = /^#{1,2}\s+(?:chapter\s+\d+[:\s]+)?(.+)$/i;
const SCENE_RE   = /^#{3,4}\s+(.+)$/;
const DIE_RE     = /\b(d4|d6|d8|d10|d12|d20|d100)\b/i;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface ParsedScene {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  sceneIndex: number;
  title: string;
  location: string | undefined;
  readAloud: string;
  description: string;
  rollTables: { name: string; die: string; entries: string[] }[];
}

function parseMarkdown(markdown: string): ParsedScene[] {
  const lines = markdown.split('\n');
  const scenes: ParsedScene[] = [];

  let chapterId = 'main';
  let chapterTitle = 'Main';
  let chapterIndex = -1;
  let sceneTitle = '';
  let sceneIndex = -1;
  let readAloud = '';
  let description = '';
  let rollTables: ParsedScene['rollTables'] = [];
  let inBlockquote = false;
  let currentBlockquote = '';
  let currentTable: { name: string; die: string; entries: string[] } | null = null;
  let hasChapters = false;

  const flushScene = () => {
    if (!sceneTitle) return;
    scenes.push({
      chapterId,
      chapterTitle,
      chapterIndex,
      sceneIndex,
      title: sceneTitle.trim(),
      location: undefined,
      readAloud: readAloud.trim(),
      description: description.trim(),
      rollTables,
    });
    sceneTitle = '';
    readAloud = '';
    description = '';
    rollTables = [];
    currentTable = null;
  };

  const flushBlockquote = () => {
    if (currentBlockquote.trim()) {
      readAloud += (readAloud ? '\n\n' : '') + currentBlockquote.trim();
    }
    currentBlockquote = '';
    inBlockquote = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Chapter heading (H1 or H2)
    const chapterMatch = trimmed.match(CHAPTER_RE);
    if (chapterMatch && (trimmed.startsWith('# ') || trimmed.startsWith('## '))) {
      flushBlockquote();
      flushScene();
      hasChapters = true;
      chapterIndex++;
      sceneIndex = -1;
      chapterTitle = chapterMatch[1].trim();
      chapterId = slugify(chapterTitle);
      continue;
    }

    // Scene heading (H3 or H4)
    const sceneMatch = trimmed.match(SCENE_RE);
    if (sceneMatch) {
      flushBlockquote();
      flushScene();
      sceneIndex++;
      sceneTitle = sceneMatch[1].trim();
      continue;
    }

    // Blockquote (read-aloud)
    if (trimmed.startsWith('> ')) {
      inBlockquote = true;
      currentBlockquote += (currentBlockquote ? '\n' : '') + trimmed.slice(2);
      continue;
    }

    if (inBlockquote && trimmed === '') {
      flushBlockquote();
      continue;
    }

    if (inBlockquote) {
      currentBlockquote += ' ' + trimmed;
      continue;
    }

    // Markdown table row
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        if (!currentTable) {
          const dieMatch = trimmed.match(DIE_RE);
          if (dieMatch) {
            currentTable = { name: sceneTitle || 'Random Table', die: dieMatch[1].toLowerCase(), entries: [] };
          }
        } else if (trimmed.includes('---')) {
          // Separator row — skip
        } else {
          currentTable.entries.push(cells[cells.length - 1]);
        }
      }
      continue;
    }

    // End of table
    if (currentTable && !trimmed.startsWith('|') && trimmed !== '') {
      rollTables.push(currentTable);
      currentTable = null;
    }

    // Body text → description
    if (trimmed && sceneTitle) {
      description += (description ? ' ' : '') + trimmed;
    }
  }

  flushBlockquote();
  flushScene();

  if (!hasChapters) {
    return scenes.map(s => ({ ...s, chapterIndex: 0 }));
  }

  const minIdx = Math.min(...scenes.map(s => s.chapterIndex));
  return scenes.map(s => ({ ...s, chapterIndex: s.chapterIndex - minIdx }));
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export async function processSourcebookSceneExtraction(
  data: SourcebookSceneExtractionJobData
): Promise<SourcebookSceneExtractionJobResult> {
  const { pdfId, markdownContent } = data;

  await prisma.sourcebookScene.deleteMany({ where: { pdfId } });

  const parsed = parseMarkdown(markdownContent);

  if (parsed.length === 0) {
    console.log(`[sourcebook-scene-extraction] No scenes found in PDF ${pdfId}`);
    return { scenesCreated: 0, chaptersFound: 0, tablesFound: 0 };
  }

  const chapters = new Set(parsed.map(s => s.chapterId)).size;
  const tables = parsed.reduce((n, s) => n + s.rollTables.length, 0);

  await prisma.sourcebookScene.createMany({
    data: parsed.map(s => ({
      pdfId,
      chapterId: s.chapterId,
      chapterTitle: s.chapterTitle,
      chapterIndex: s.chapterIndex,
      sceneIndex: s.sceneIndex,
      title: s.title,
      location: s.location ?? null,
      readAloud: s.readAloud || null,
      description: s.description || null,
      linkedNpcs: [],
      linkedMonsters: [],
      rollTables: s.rollTables,
    })),
  });

  console.log(`[sourcebook-scene-extraction] PDF ${pdfId}: ${parsed.length} scenes, ${chapters} chapters, ${tables} tables`);
  return { scenesCreated: parsed.length, chaptersFound: chapters, tablesFound: tables };
}

const worker = new Worker<SourcebookSceneExtractionJobData, SourcebookSceneExtractionJobResult>(
  'sourcebook-scene-extraction',
  async job => processSourcebookSceneExtraction(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('completed', job => {
  console.log(`[sourcebook-scene-extraction] Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[sourcebook-scene-extraction] Failed: ${job?.id}`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
