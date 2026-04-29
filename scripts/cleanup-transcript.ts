/**
 * Post-process a transcript-for-coding.json to produce a more readable
 * master-transcript.md.
 *
 * Pipeline order:
 *   1. Apply term corrections (corrections.json)
 *   2. AI OOC pass — GPT-4o-mini flags non-gameplay utterances (skip with --skip-ai)
 *   3. Merge short utterances (≤4 words) into adjacent same-speaker lines
 *   4. Drop standalone pure filler words
 *   5. Write master-transcript.md + ooc-review.md
 *
 * Run: npx tsx scripts/cleanup-transcript.ts [directory] [--skip-ai]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

// ─── Config ──────────────────────────────────────────────────────────────────

const SHORT_WORD_THRESHOLD  = 4;
const MERGE_GAP_MS          = 8000;
const MAX_MERGE_PASSES      = 10;
const OOC_AUTO_DROP_THRESHOLD = 0.92;
const OOC_BATCH_SIZE        = 100;

const TOOLS_DIR = path.resolve(__dirname, '..', 'docs', 'transcription-tools');
const GLOBAL_CORRECTIONS_PATH  = path.join(TOOLS_DIR, 'corrections-global.json');
const PENDING_CORRECTIONS_PATH = path.join(TOOLS_DIR, 'corrections-pending.json');

const FILLER_WORDS = new Set([
  'yeah', 'yep', 'yup',
  'uh', 'um', 'hmm', 'hm', 'mm', 'ah', 'aw', 'huh',
  'ha', 'haha', 'lol',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Entry {
  speaker: string;
  start: number;
  end: number;
  start_formatted: string;
  end_formatted: string;
  text: string;
}

interface OOCResult {
  index: number;
  classification: 'gameplay' | 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function isFiller(text: string): boolean {
  const stripped = text.trim().toLowerCase().replace(/[^a-z]/g, '');
  return FILLER_WORDS.has(stripped);
}

function mergeEntries(a: Entry, b: Entry): Entry {
  return {
    speaker: a.speaker,
    start: a.start,
    end: b.end,
    start_formatted: a.start_formatted,
    end_formatted: b.end_formatted,
    text: `${a.text} ${b.text}`.trim(),
  };
}

// ─── Merge passes ────────────────────────────────────────────────────────────

function forwardPass(entries: Entry[]): { entries: Entry[]; changed: boolean } {
  const out: Entry[] = [];
  let changed = false;
  let i = 0;

  while (i < entries.length) {
    const cur = entries[i];

    if (wordCount(cur.text) <= SHORT_WORD_THRESHOLD) {
      const nextIdx = entries.findIndex((e, j) => j > i && e.speaker === cur.speaker);
      if (nextIdx !== -1 && entries[nextIdx].start - cur.end <= MERGE_GAP_MS) {
        entries[nextIdx] = mergeEntries(cur, entries[nextIdx]);
        changed = true;
        i++;
        continue;
      }
    }

    out.push(cur);
    i++;
  }

  return { entries: out, changed };
}

function backwardPass(entries: Entry[]): { entries: Entry[]; changed: boolean } {
  const out: Entry[] = [...entries];
  let changed = false;

  for (let i = entries.length - 1; i >= 0; i--) {
    const cur = out[i];
    if (!cur) continue;

    if (wordCount(cur.text) <= SHORT_WORD_THRESHOLD) {
      let prevIdx = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (out[j] && out[j].speaker === cur.speaker) { prevIdx = j; break; }
      }
      if (prevIdx !== -1 && cur.start - out[prevIdx].end <= MERGE_GAP_MS) {
        out[prevIdx] = mergeEntries(out[prevIdx], cur);
        (out as (Entry | null)[])[i] = null;
        changed = true;
      }
    }
  }

  return { entries: out.filter(Boolean) as Entry[], changed };
}

function runMergePasses(entries: Entry[]): Entry[] {
  let current = [...entries];
  for (let pass = 0; pass < MAX_MERGE_PASSES; pass++) {
    const fwd = forwardPass(current);
    current = fwd.entries;
    const bwd = backwardPass(current);
    current = bwd.entries;
    if (!fwd.changed && !bwd.changed) break;
  }
  return current;
}

// ─── Session start trim ──────────────────────────────────────────────────────

const SESSION_START_PHRASES = [
  'last session', 'last time', 'where we left', 'left off',
  'picking up', 'previously on', 'where we pick up',
];

function trimPreSessionNoise(entries: Entry[]): { entries: Entry[]; trimmed: number } {
  const idx = entries.findIndex(e =>
    SESSION_START_PHRASES.some(p => e.text.toLowerCase().includes(p))
  );
  if (idx <= 0) return { entries, trimmed: 0 };
  return { entries: entries.slice(idx), trimmed: idx };
}

// ─── Corrections DB ──────────────────────────────────────────────────────────

function loadAllCorrections(dir: string): Record<string, string> {
  const campaignDir = path.dirname(dir);
  const sources = [
    GLOBAL_CORRECTIONS_PATH,
    path.join(campaignDir, 'corrections-campaign.json'),
    path.join(dir, 'corrections.json'),
  ];
  const merged: Record<string, string> = {};
  let total = 0;
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    const data: Record<string, string> = JSON.parse(fs.readFileSync(src, 'utf8'));
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith('_') && v && v !== 'TODO') {
        merged[k] = v;
        total++;
      }
    }
  }
  console.log(`Loaded ${total} corrections (global + campaign + local)`);
  return merged;
}

// ─── Corrections discovery ───────────────────────────────────────────────────

interface PendingCorrection {
  wrong: string;
  correct: string;
  confidence: number;
  type: string;
  session: string;
  context: string;
  discovered: string;
}

const DISCOVERY_SYSTEM_PROMPT = `You are reviewing raw D&D tabletop session transcript utterances for speech-to-text transcription errors.

Identify words or phrases that appear to be transcription errors of:
- D&D 5e spell names (e.g. "chromatic bolt" → "Chromatic Orb", "revival fire" → "Revivify")
- D&D 5e class features or abilities (e.g. "second when" → "Second Wind", "action search" → "Action Surge")
- D&D 5e monsters, races, or creature types (e.g. "githyonki" → "githyanki")
- Campaign proper nouns — character names, NPC names, place names — that appear mangled
- Forgotten Realms / D&D setting terms: locations, factions, organizations

Rules:
- Only return HIGH CONFIDENCE identifications (confidence ≥ 0.85)
- "wrong" must be the EXACT phrase as it appears in the text
- Skip common English words even if they seem odd — they may be intentional
- Skip anything already listed as a known correction
- Return empty array [] if nothing new found

Return JSON array only (no markdown):
[{"wrong": "exact text", "correct": "corrected text", "confidence": 0.0-1.0, "type": "spell|ability|monster|character|place|faction|other"}]`;

async function discoverCorrections(
  client: OpenAI,
  raw: Entry[],
  knownCorrections: Record<string, string>,
  campaignDir: string,
  sessionLabel: string,
): Promise<void> {
  const pendingPath = PENDING_CORRECTIONS_PATH;

  // Sample: beginning, middle, end (up to 100 each)
  const total = raw.length;
  const mid = Math.floor(total / 2);
  const sample = [
    ...raw.slice(0, 100),
    ...raw.slice(Math.max(0, mid - 50), mid + 50),
    ...raw.slice(Math.max(0, total - 100)),
  ];

  const knownList = Object.entries(knownCorrections)
    .map(([k, v]) => `"${k}" → "${v}"`)
    .join('\n');

  const systemPrompt = `${DISCOVERY_SYSTEM_PROMPT}\n\nAlready known corrections — skip these:\n${knownList}`;

  const discovered: PendingCorrection[] = [];
  const BATCH = 100;
  const totalBatches = Math.ceil(sample.length / BATCH);

  for (let i = 0; i < sample.length; i += BATCH) {
    const batch = sample.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    process.stdout.write(`  Discovery batch ${batchNum}/${totalBatches}...`);

    const batchText = batch.map(e => e.text).join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: batchText },
      ],
    });

    let raw2 = (response.choices[0]?.message?.content ?? '').trim();
    if (raw2.startsWith('```')) raw2 = raw2.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const results: Array<{ wrong: string; correct: string; confidence: number; type: string }> = JSON.parse(raw2);

    for (const r of results) {
      const ctx = batch.find(e => e.text.toLowerCase().includes(r.wrong.toLowerCase()));
      discovered.push({
        ...r,
        session: sessionLabel,
        context: ctx?.text?.slice(0, 120) ?? '',
        discovered: new Date().toISOString().split('T')[0],
      });
    }

    console.log(` done (${results.length} found)`);
  }

  if (discovered.length === 0) {
    console.log('  No new corrections discovered.');
    return;
  }

  // Load existing pending, deduplicate by wrong term
  let existing: PendingCorrection[] = [];
  if (fs.existsSync(pendingPath)) {
    existing = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  }

  const existingKeys = new Set(existing.map(e => e.wrong.toLowerCase()));
  const newEntries = discovered.filter(d => !existingKeys.has(d.wrong.toLowerCase()));

  if (newEntries.length === 0) {
    console.log(`  ${discovered.length} candidate(s) found, all already pending.`);
    return;
  }

  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify([...existing, ...newEntries], null, 2), 'utf8');
  console.log(`  +${newEntries.length} new → ${pendingPath}`);
}

// ─── Term corrections ────────────────────────────────────────────────────────

function applyCorrections(
  entries: Entry[],
  corrections: Record<string, string>,
): { entries: Entry[]; count: number } {
  if (Object.keys(corrections).length === 0) return { entries, count: 0 };

  const rules = Object.entries(corrections)
    .filter(([k, v]) => !k.startsWith('_') && v && v !== 'TODO')
    .map(([wrong, correct]) => ({
      pattern: new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      correct,
    }));

  let count = 0;
  const updated = entries.map(e => {
    let text = e.text;
    for (const { pattern, correct } of rules) {
      const replaced = text.replace(pattern, correct);
      if (replaced !== text) count++;
      text = replaced;
    }
    return { ...e, text };
  });

  return { entries: updated, count };
}

// ─── AI OOC pass ─────────────────────────────────────────────────────────────

const OOC_SYSTEM_PROMPT = `You are reviewing a D&D tabletop session transcript.

Return ONLY utterances that are out-of-character (OOC) or uncertain. Skip all gameplay lines.

ALWAYS gameplay — never flag these:
- DM narration of any kind: locations, scene transitions, NPC actions, descriptions — "you see...", "you come across...", "you walk in...", "after traveling...", "as you approach...", "there's a sign...", "you can see that..."
- DM narration fragments: even a short DM phrase like "through the gate" or "the drunken druid" is gameplay if it's scene-setting
- Player declared actions: "I attack", "I cast", "I move", "I investigate", "I roll", "I talk to..."
- In-character roleplay: a player speaking AS their character to another character or NPC
- Combat mechanics: initiative, attack rolls, damage, HP, spell slots, conditions, saving throws
- Rules questions about the current encounter or action in play
- Loot, currency, inventory during the session ("do I put it in my inventory?", "I'll take the gold")
- Character knowledge/perception checks: "do I know that?", "can I see him?"
- In-game questions about NPCs, plot, or events: "is he important?", "who are they?", "what happened to X?", "do we know him?", "why are they here?"
- Questions about in-game accommodations, travel, or current situation: "are there rooms here?", "how far is it?", "are we taking him with us?"

OOC = clearly non-session:
- Tech issues: mic problems, audio/connection drops, browser/app errors, "can you hear me?"
- Real-world breaks: bathroom, food delivery, "brb", people arriving/leaving IRL
- Personal conversations completely unrelated to the session (weekend plans, substances, personal life)
- Session scheduling: "next week?", "who's here?", "Matt's gone for two weeks", character creation outside of play
- Platform meta: Discord settings, DnDBeyond login issues, screen sharing problems

Uncertain = plausibly gameplay but context is ambiguous without surrounding lines — flag for human review.
Short fragments and single words should be "uncertain", not "ooc".

Be extremely conservative with DM lines — when in doubt, DM narration is always gameplay.

Return a JSON array of flagged lines only (empty array [] if none):
[{"index": <n>, "c": "ooc|uncertain", "confidence": 0.0-1.0, "reason": "brief note"}]`;

async function aiOOCPass(
  client: OpenAI,
  entries: Entry[],
  speakerMap: Record<string, string>,
): Promise<{
  entries: Entry[];
  droppedOoc: number;
  flaggedUncertain: number;
  reviewLines: string[];
}> {
  const displayName = (id: string) => speakerMap[id] ?? id;
  const allResults: OOCResult[] = [];
  const totalBatches = Math.ceil(entries.length / OOC_BATCH_SIZE);

  for (let i = 0; i < entries.length; i += OOC_BATCH_SIZE) {
    const batch = entries.slice(i, i + OOC_BATCH_SIZE);
    const batchNum = Math.floor(i / OOC_BATCH_SIZE) + 1;

    const batchText = batch
      .map((e, j) => `${i + j}: [${displayName(e.speaker)}] ${e.text}`)
      .join('\n');

    process.stdout.write(`  OOC batch ${batchNum}/${totalBatches}...`);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0,
      messages: [
        { role: 'system', content: OOC_SYSTEM_PROMPT },
        { role: 'user', content: batchText },
      ],
    });

    let raw = (response.choices[0]?.message?.content ?? '').trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const batchResults: Array<{ index: number; c: string; confidence: number; reason: string }> = JSON.parse(raw);
    const mapped: OOCResult[] = batchResults.map(r => ({
      index: r.index,
      classification: (r.c === 'ooc' ? 'ooc' : 'uncertain') as OOCResult['classification'],
      confidence: r.confidence,
      reason: r.reason,
    }));
    allResults.push(...mapped);

    console.log(` done${mapped.length > 0 ? ` (${mapped.length} flagged)` : ''}`);
  }

  // Entries to auto-drop
  const dropIndices = new Set(
    allResults
      .filter(r => r.classification === 'ooc' && r.confidence >= OOC_AUTO_DROP_THRESHOLD)
      .map(r => r.index),
  );

  // Build review document
  const reviewLines: string[] = [
    '# OOC Review\n',
    `Auto-drop threshold: confidence ≥ ${OOC_AUTO_DROP_THRESHOLD}\n`,
  ];

  const autoDrop = allResults.filter(
    r => r.classification === 'ooc' && r.confidence >= OOC_AUTO_DROP_THRESHOLD,
  );
  const flagged = allResults.filter(
    r => r.classification === 'uncertain' || (r.classification === 'ooc' && r.confidence < OOC_AUTO_DROP_THRESHOLD),
  );

  reviewLines.push(`\n## Auto-dropped (${autoDrop.length})\n`);
  for (const r of autoDrop) {
    const e = entries[r.index];
    reviewLines.push(`- [${r.index}] **${displayName(e?.speaker ?? '')}:** ${e?.text ?? ''}`);
    reviewLines.push(`  - *${r.reason} (confidence: ${r.confidence})*\n`);
  }

  reviewLines.push(`\n## Flagged for review (${flagged.length})\n`);
  for (const r of flagged) {
    const e = entries[r.index];
    reviewLines.push(`- [${r.index}] **${displayName(e?.speaker ?? '')}:** ${e?.text ?? ''}`);
    reviewLines.push(`  - *${r.classification} — ${r.reason} (confidence: ${r.confidence})*\n`);
  }

  if (autoDrop.length === 0 && flagged.length === 0) {
    reviewLines.push('No OOC content detected.\n');
  }

  const filtered = entries.filter((_, i) => !dropIndices.has(i));

  return {
    entries: filtered,
    droppedOoc: autoDrop.length,
    flaggedUncertain: flagged.length,
    reviewLines,
  };
}

// ─── Filler drop ─────────────────────────────────────────────────────────────

function dropStandaloneFillers(
  entries: Entry[],
): { entries: Entry[]; dropped: number } {
  const kept = entries.filter(e => !(wordCount(e.text) === 1 && isFiller(e.text)));
  return { entries: kept, dropped: entries.length - kept.length };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function buildMarkdown(
  entries: Entry[],
  speakers: string[],
  sessionName: string,
  speakerMap: Record<string, string>,
): string {
  const displayName = (id: string) => speakerMap[id] ?? id;

  const lines: string[] = [
    `# ${sessionName} — Session Transcript`,
    '',
    `**Participants:** ${speakers.map(displayName).join(', ')}`,
    `**Utterances:** ${entries.length}`,
    '',
    '---',
    '',
  ];

  for (const e of entries) {
    lines.push(`**[${e.start_formatted}] ${displayName(e.speaker)}:** ${e.text.trim()}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const skipAi = args.includes('--skip-ai');
  const dir = args.find(a => !a.startsWith('--')) ?? 'e:/Projects/QuiverDM/docs/Test/transcription/Jordans 2nd Campaign';
  const sessionName = path.basename(dir);

  const jsonPath = path.join(dir, 'transcript-for-coding.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('transcript-for-coding.json not found:', jsonPath);
    process.exit(1);
  }

  const raw: Entry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${raw.length} utterances`);

  // Step 1 — Corrections (global → campaign → local)
  const corrections = loadAllCorrections(dir);

  const speakersPath = path.join(dir, 'speakers.json');
  let speakerMap: Record<string, string> = {};
  if (fs.existsSync(speakersPath)) {
    speakerMap = JSON.parse(fs.readFileSync(speakersPath, 'utf8'));
    console.log(`Loaded ${Object.keys(speakerMap).length} speaker mappings`);
  }

  const { entries: corrected, count: correctionCount } = applyCorrections(raw, corrections);
  if (correctionCount > 0) console.log(`Applied ${correctionCount} term corrections`);

  // Step 2 — Trim pre-session noise
  const { entries: trimmed, trimmed: trimCount } = trimPreSessionNoise(corrected);
  if (trimCount > 0) console.log(`Trimmed ${trimCount} pre-session utterances`);

  // Step 3 — Merge short utterances (before OOC so AI sees assembled lines)
  const merged = runMergePasses(trimmed);
  console.log(`After merge: ${merged.length} utterances (removed ${trimmed.length - merged.length})`);

  // Collect unique speakers in order of first appearance
  const speakerOrder: string[] = [];
  const seen = new Set<string>();
  for (const e of merged) {
    if (!seen.has(e.speaker)) { speakerOrder.push(e.speaker); seen.add(e.speaker); }
  }

  // Step 4 — AI OOC pass (on merged entries — far fewer fragments)
  let oocFiltered = merged;
  if (!skipAi) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('No OPENAI_API_KEY — skipping AI OOC pass (use --skip-ai to suppress this warning)');
    } else {
      console.log(`\nRunning AI OOC pass on ${merged.length} utterances...`);
      const client = new OpenAI({ apiKey });
      const { entries, droppedOoc, flaggedUncertain, reviewLines } = await aiOOCPass(client, merged, speakerMap);
      oocFiltered = entries;

      const reviewPath = path.join(dir, 'ooc-review.md');
      fs.writeFileSync(reviewPath, reviewLines.join('\n'), 'utf8');
      console.log(`AI OOC: auto-dropped ${droppedOoc}, flagged ${flaggedUncertain} for review → ooc-review.md`);
    }
  } else {
    console.log('Skipping AI OOC pass (--skip-ai)');
  }

  // Step 5 — Drop standalone fillers
  const { entries: clean, dropped } = dropStandaloneFillers(oocFiltered);
  console.log(`After filler drop: ${clean.length} utterances (removed ${dropped} fillers)`);

  // Rebuild timestamps
  for (const e of clean) {
    e.start_formatted = formatTimestamp(e.start);
    e.end_formatted   = formatTimestamp(e.end);
  }

  const mdPath = path.join(dir, 'master-transcript.md');
  fs.writeFileSync(mdPath, buildMarkdown(clean, speakerOrder, sessionName, speakerMap), 'utf8');
  console.log(`\nWrote: ${mdPath}`);

  const totalMs = clean.length > 0 ? clean[clean.length - 1].end : 0;
  console.log(`Session duration: ~${formatTimestamp(totalMs)}`);

  // Step 6 — Corrections discovery (append new findings to shared pending DB)
  if (!skipAi) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      console.log('\nRunning corrections discovery...');
      const client = new OpenAI({ apiKey });
      const campaignDir = path.dirname(dir);
      const sessionLabel = `${path.basename(campaignDir)} / ${path.basename(dir)}`;
      await discoverCorrections(client, raw, corrections, campaignDir, sessionLabel);
    }
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
