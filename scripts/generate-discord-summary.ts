/**
 * Generate Discord-formatted session recaps from a master-transcript.md.
 *
 * Produces three style variants, each in standard (≤2000) and nitro (≤4000):
 *   chronicle  — formal in-world scribe, third person, authoritative
 *   campfire   — casual "you won't believe what happened" retelling
 *   legend     — mythic/bardic, fate-heavy, elevated language
 *
 * Outputs (per style):
 *   discord-post-{style}.md
 *   discord-post-{style}-nitro.md
 *
 * Run:
 *   npx tsx scripts/generate-discord-summary.ts [directory] [style|all]
 *   style defaults to "all"
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const STANDARD_LIMIT = 2000;

const HIGHLIGHT_EMOJI: Record<string, string> = {
  combat:      '⚔️',
  decision:    '🎲',
  npc_change:  '👤',
  cliffhanger: '😱',
  loot:        '💰',
  death:       '💀',
};

const FOOTNOTE = '\n\n-# 🤖 Auto-posting to Discord via QuiverDM Bot — *coming soon*';

// ─── Style prompts ────────────────────────────────────────────────────────────

const BASE_RULES = `
Discord markdown rules (IMPORTANT):
- **bold** for emphasis — NOT # headers (they don't render in Discord)
- *italic* for atmosphere or names
- Keep line breaks minimal — this is a message, not a document

Output ONLY valid JSON, no markdown fences:
{
  "title": "Session N — Evocative Subtitle",
  "recap": "The narrative recap string",
  "highlights": [
    { "type": "combat|decision|npc_change|cliffhanger|loot|death", "text": "One sentence." }
  ]
}

Rules:
- 3–5 highlights, things that actually happened
- Use character names (not player names)
- recap fills available space — make every sentence earn its place
- cliffhanger type for anything unresolved at session end`;

const STYLES: Record<string, string> = {

  chronicle: `You are the official campaign scribe — a learned archivist recording events for posterity.

Style: third person, past tense, formal but not stiff. Measured and authoritative. Every sentence carries weight. Focus on *what happened and why it mattered*. Name characters precisely. Acknowledge death with gravity. No jokes, no player asides.

Target feel: an entry in a leather-bound campaign journal that someone might actually want to re-read.
${BASE_RULES}`,

  campfire: `You are one of the players breathlessly recapping last session at the start of the next one.

Style: first person plural ("we", "our"), present-tense energy, casual and exclamatory. Capture the chaos, the bad luck, the clutch moments, and the laughs. Allowed to editorialize ("which was honestly a terrible idea but it worked"). Drop player names where it adds colour. Make it sound like a great story to tell.

Target feel: "okay so you won't BELIEVE what happened last session—"
${BASE_RULES}`,

  legend: `You are a bardic chronicler, writing as though these events will be remembered for generations.

Style: elevated, fate-heavy, third person. Use mythic weight — "it was said that", "the fates decreed", "from that day forward". Favour consequence and significance over moment-to-moment detail. Make deaths feel legendary. Make victories feel earned. Make failures feel tragic, not silly.

Target feel: the opening narration of a campaign documentary, or a bardic ballad that captures the soul of the session.
${BASE_RULES}`,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryData {
  title: string;
  recap: string;
  highlights: Array<{ type: string; text: string }>;
}

// ─── Build Discord post ───────────────────────────────────────────────────────

function buildPost(data: SummaryData, limit: number): string {
  const header = `**${data.title}**\n\n`;
  const highlightLines = data.highlights
    .map(h => `${HIGHLIGHT_EMOJI[h.type] ?? '•'} ${h.text}`)
    .join('\n');
  const highlightBlock = `\n\n**Session Highlights**\n${highlightLines}`;
  const full = header + data.recap + highlightBlock + FOOTNOTE;

  if (full.length <= limit) return full;

  const fixed = header + highlightBlock + FOOTNOTE;
  const available = limit - fixed.length - 1;
  if (available > 60) {
    return header + data.recap.slice(0, available) + '…' + highlightBlock + FOOTNOTE;
  }
  return (header + data.recap).slice(0, limit - FOOTNOTE.length - 1) + '…' + FOOTNOTE;
}

// ─── Generate one style ───────────────────────────────────────────────────────

async function generateStyle(
  client: OpenAI,
  transcript: string,
  styleName: string,
): Promise<SummaryData> {
  const systemPrompt = STYLES[styleName];
  console.log(`  [${styleName}] Requesting from GPT-4o...`);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.8,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Session transcript:\n\n${transcript}` },
    ],
  });

  let raw = (response.choices[0]?.message?.content ?? '').trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  const data: SummaryData = JSON.parse(raw);
  console.log(`  [${styleName}] "${data.title}" — recap ${data.recap.length} chars, ${data.highlights.length} highlights`);
  return data;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dir      = process.argv[2] ?? 'e:/Projects/QuiverDM/docs/Test/transcription/Jordans 2nd Campaign';
  const styleArg = process.argv[3] ?? 'all';
  const stylesToRun = styleArg === 'all' ? Object.keys(STYLES) : [styleArg];

  if (stylesToRun.some(s => !STYLES[s])) {
    console.error(`Unknown style. Valid: ${Object.keys(STYLES).join(', ')}, all`);
    process.exit(1);
  }

  const transcriptPath = path.join(dir, 'master-transcript.md');
  if (!fs.existsSync(transcriptPath)) {
    console.error('master-transcript.md not found:', transcriptPath);
    process.exit(1);
  }

  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  console.log(`Transcript: ${transcript.length} chars`);
  console.log(`Styles: ${stylesToRun.join(', ')}\n`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error('No OPENAI_API_KEY'); process.exit(1); }
  const client = new OpenAI({ apiKey });

  for (const styleName of stylesToRun) {
    try {
      const data = await generateStyle(client, transcript, styleName);

      const post    = buildPost(data, STANDARD_LIMIT);
      const outPath = path.join(dir, `discord-post-${styleName}.md`);

      fs.writeFileSync(outPath, post, 'utf8');

      console.log(`  [${styleName}] ${post.length}/${STANDARD_LIMIT} chars → ${path.basename(outPath)}`);
      console.log(`\n--- ${styleName.toUpperCase()} PREVIEW ---\n${post}\n`);
    } catch (err) {
      console.error(`  [${styleName}] FAILED:`, err);
    }
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
