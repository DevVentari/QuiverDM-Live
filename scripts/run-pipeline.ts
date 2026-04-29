/**
 * Full transcription pipeline runner.
 *
 * Steps:
 *   1. transcribe-session-tracks   — FLAC → transcript-for-coding.json + raw master-transcript.md
 *   2. cleanup-transcript           — corrections + trim + merge + OOC + discovery
 *   3. generate-session-report      — AI extraction → session-report.json + Hugo site
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts <session-dir> [--skip-ai] [--skip-transcription]
 *
 *   --skip-ai              Skip AI calls in cleanup (OOC + discovery)
 *   --skip-transcription   Skip step 1 (use existing transcript-for-coding.json)
 *
 * Required env:
 *   ASSEMBLYAI_API_KEY  (unless --skip-transcription)
 *   OPENAI_API_KEY
 */

import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const TSX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const SCRIPTS = path.resolve(__dirname);

function step(label: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
}

function run(script: string, args: string[]): void {
  const result = spawnSync(TSX, ['tsx', path.join(SCRIPTS, script), ...args], {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`\n[run-pipeline] ${script} exited with code ${result.status ?? 'null'}`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const skipAi = argv.includes('--skip-ai');
  const skipTranscription = argv.includes('--skip-transcription');
  const dir = argv.find(a => !a.startsWith('--'));

  if (!dir) {
    console.error('Usage: npx tsx scripts/run-pipeline.ts <session-dir> [--skip-ai] [--skip-transcription]');
    process.exit(1);
  }

  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) {
    console.error('Session directory not found:', absDir);
    process.exit(1);
  }

  console.log(`\nPipeline target: ${absDir}`);

  // Step 1 — Transcription
  if (skipTranscription) {
    const codingJson = path.join(absDir, 'transcript-for-coding.json');
    if (!fs.existsSync(codingJson)) {
      console.error('[run-pipeline] --skip-transcription set but transcript-for-coding.json not found:', codingJson);
      process.exit(1);
    }
    console.log('\n[Step 1 — Transcription] SKIPPED (using existing transcript-for-coding.json)');
  } else {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      console.error('[run-pipeline] ASSEMBLYAI_API_KEY not set. Use --skip-transcription to skip step 1.');
      process.exit(1);
    }
    step('Step 1 — Transcription (AssemblyAI multi-track)');
    run('transcribe-session-tracks.ts', [absDir]);
  }

  // Step 2 — Cleanup
  step('Step 2 — Cleanup (corrections + trim + merge + OOC + discovery)');
  const cleanupArgs = [absDir];
  if (skipAi) cleanupArgs.push('--skip-ai');
  run('cleanup-transcript.ts', cleanupArgs);

  // Step 3 — Session report
  step('Step 3 — Session report (AI extraction + Hugo build)');
  run('generate-session-report.ts', [absDir]);

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Pipeline complete');
  console.log('═'.repeat(60));
  console.log(`\n  Output: ${absDir}/session-report.json`);
  console.log(`  Review: ${absDir}/ooc-review.md`);
  const pending = path.resolve(SCRIPTS, '..', 'docs', 'transcription-tools', 'corrections-pending.json');
  console.log(`  Pending corrections: ${pending}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
