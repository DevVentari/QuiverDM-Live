/**
 * One-time script to generate dungeon background video assets via Veo 2 (Gemini API).
 *
 * Usage:
 *   npx ts-node --esm scripts/generate-bg-video.ts
 *
 * After generation, compress the output with ffmpeg:
 *   ffmpeg -i public/video/dungeon-bg-raw.mp4 -c:v libvpx-vp9 -crf 33 -b:v 0 -vf scale=1920:1080 public/video/dungeon-bg.webm
 *   ffmpeg -i public/video/dungeon-bg-raw.mp4 -c:v libx264 -crf 28 -preset slow -vf scale=1920:1080 public/video/dungeon-bg.mp4
 *   ffmpeg -i public/video/dungeon-bg-raw.mp4 -vframes 1 -q:v 2 public/video/dungeon-bg-poster.jpg
 *
 * Target: ~2-5MB WebM, ~4-8MB MP4. Both placed in public/video/.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in .env');
  process.exit(1);
}

const PROMPTS = [
  'Two massive ancient stone guardian statues flanking a towering stone archway gate, dark fantasy dungeon entrance, glowing warm amber magical energy emanating from between the statues, flickering torchlight on weathered stone, floating ember particles and dust motes drifting upward, ground fog rolling slowly across a stone floor, dramatic low-angle cinematic lighting, deep shadows, extremely slow camera drift, no people no characters no text, atmospheric moody dark fantasy, seamlessly loopable ambient scene',
];

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/video');

async function generateVideo(prompt: string, index: number): Promise<void> {
  console.log(`\nGenerating video ${index + 1}/${PROMPTS.length}...`);
  console.log(`Prompt: ${prompt.slice(0, 80)}...`);

  // Initiate generation
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio: '16:9',
          durationSeconds: 16,
          fps: 24,
          sampleCount: 1,
          generateAudio: false,
          negativePrompt: 'people, characters, text, watermark, bright, daytime, outdoor',
        },
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Init failed (${initRes.status}): ${err}`);
  }

  const operation = (await initRes.json()) as { name: string };
  console.log(`Operation started: ${operation.name}`);

  // Poll until done
  let done = false;
  let videoUri: string | undefined;

  while (!done) {
    await new Promise((r) => setTimeout(r, 10_000));

    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${GEMINI_API_KEY}`
    );
    const status = (await pollRes.json()) as {
      done?: boolean;
      response?: { predictions: Array<{ video: { uri: string } }> };
      error?: { message: string };
    };

    if (status.error) {
      throw new Error(`Generation failed: ${status.error.message}`);
    }

    if (status.done) {
      done = true;
      videoUri = status.response?.predictions?.[0]?.video?.uri;
    } else {
      process.stdout.write('.');
    }
  }

  if (!videoUri) {
    throw new Error('No video URI in response');
  }

  // Download the raw video
  const outputPath = path.join(OUTPUT_DIR, `dungeon-bg-raw-${index}.mp4`);
  console.log(`\nDownloading to ${outputPath}...`);

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(videoUri!, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });

  console.log(`Saved: ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (let i = 0; i < PROMPTS.length; i++) {
    try {
      await generateVideo(PROMPTS[i], i);
    } catch (err) {
      console.error(`Failed to generate video ${i + 1}:`, err);
    }
  }

  console.log('\nDone. Now compress with ffmpeg (see script header for commands).');
}

main();
