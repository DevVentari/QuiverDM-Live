/**
 * Quick diagnostic: simulate the multi-track worker's resolveAudioUrl + AssemblyAI submit
 * for the latest failed recording.
 *
 * Run: npx tsx scripts/test-multitrack-local.ts
 */
import 'dotenv/config';
import * as path from 'path';
import { prisma } from '../src/lib/prisma';
import { isLocalStorage } from '../src/lib/storage';

async function main() {
  const rec = await prisma.sessionRecording.findFirst({
    where: { mergeStatus: 'failed' },
    orderBy: { createdAt: 'desc' },
  });

  if (!rec) {
    console.log('No failed recordings found');
    return;
  }

  console.log('Latest failed recording:');
  console.log('  id:', rec.id);
  console.log('  originalUrl:', rec.originalUrl);
  console.log('  isLocalStorage:', isLocalStorage());

  // Resolve path
  const key = rec.originalUrl;
  const diskPath = path.resolve(process.cwd(), 'storage', key);
  console.log('\nExpected disk path:', diskPath);

  // Check file exists
  const fs = await import('fs');
  const exists = fs.existsSync(diskPath);
  console.log('File exists on disk:', exists);

  if (!exists) {
    // List what IS in storage/session-recordings
    const storageDir = path.resolve(process.cwd(), 'storage', 'session-recordings');
    console.log('\nActual files in storage/session-recordings:');
    try {
      const listDir = (d: string, depth = 0): void => {
        if (depth > 3) return;
        const entries = fs.readdirSync(d);
        for (const e of entries) {
          console.log('  '.repeat(depth + 1) + e);
          const full = path.join(d, e);
          if (fs.statSync(full).isDirectory()) listDir(full, depth + 1);
        }
      };
      listDir(storageDir);
    } catch (e) {
      console.log('  (directory not found)');
    }
    return;
  }

  const stat = fs.statSync(diskPath);
  console.log('File size:', stat.size, 'bytes');

  // Try AssemblyAI submit
  console.log('\nAttempting AssemblyAI upload...');
  const { submitAsyncTranscription } = await import('../src/lib/transcription/assemblyai');
  try {
    const id = await submitAsyncTranscription({
      audioUrl: diskPath,
      speakerLabels: false,
      wordBoost: [],
    });
    console.log('AssemblyAI transcript ID:', id);
  } catch (e) {
    console.error('AssemblyAI error:', e);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
