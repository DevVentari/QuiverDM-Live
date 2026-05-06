#!/usr/bin/env node
/**
 * Downloads all SVG icons from intrinsical/tw-dnd into public/icons/dnd/
 * Run: node scripts/sync-dnd-icons.mjs
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'icons', 'dnd');
const REPO = 'intrinsical/tw-dnd';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuiverDM-icon-sync' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function fetchRaw(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuiverDM-icon-sync' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

async function main() {
  console.log('Fetching file tree from GitHub...');
  const tree = await fetchJson(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`
  );

  const svgFiles = tree.tree.filter(
    (f) => f.type === 'blob' && f.path.startsWith('icons/') && f.path.endsWith('.svg')
  );

  console.log(`Found ${svgFiles.length} SVG icons.`);

  let downloaded = 0;
  let failed = 0;

  for (const file of svgFiles) {
    // file.path = "icons/dice/d20.svg"
    // relative = "dice/d20.svg"
    const relative = file.path.slice('icons/'.length);
    const dest = join(OUT_DIR, relative);
    const destDir = dirname(dest);

    try {
      await mkdir(destDir, { recursive: true });
      const content = await fetchRaw(`${RAW_BASE}/${file.path}`);
      await writeFile(dest, content, 'utf8');
      downloaded++;
      if (downloaded % 25 === 0) {
        process.stdout.write(`  ${downloaded}/${svgFiles.length}...\n`);
      }
    } catch (err) {
      console.error(`  FAIL: ${file.path} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${downloaded} downloaded, ${failed} failed.`);
  console.log(`Icons saved to: public/icons/dnd/`);

  // Print category summary
  const categories = [...new Set(svgFiles.map((f) => f.path.split('/')[1]))].sort();
  console.log(`\nCategories (${categories.length}):`);
  for (const cat of categories) {
    const count = svgFiles.filter((f) => f.path.split('/')[1] === cat).length;
    console.log(`  ${cat.padEnd(20)} ${count} icons`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
