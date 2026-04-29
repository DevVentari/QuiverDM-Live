/**
 * Generate a session report from master-transcript.md.
 *
 * Extracts structured data via OpenAI GPT-4o, then:
 *   1. Writes session-report.json (raw data)
 *   2. Writes a Hugo Markdown page to docs/campaign-site/content/sessions/
 *   3. Builds the Hugo site (docs/campaign-site/public/)
 *   4. Renders a PDF via Playwright (session-report.pdf)
 *
 * Run: npx tsx scripts/generate-session-report.ts [directory]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import OpenAI from 'openai';
import { chromium } from 'playwright';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NPC {
  name: string;
  role: string;
  description: string;
  status: 'alive' | 'dead' | 'unknown';
  faction?: string;
}

interface Location {
  name: string;
  description: string;
  significance: string;
}

interface Item {
  name: string;
  description: string;
  holder: string;
  magical: boolean;
}

interface Event {
  title: string;
  description: string;
  type: 'combat' | 'discovery' | 'death' | 'revelation' | 'social' | 'travel';
}

interface PlotThread {
  title: string;
  description: string;
  status: 'active' | 'resolved' | 'unresolved';
}

interface SessionData {
  sessionTitle: string;
  sessionNumber: number;
  summary: string;
  party: Array<{ character: string; player: string; status: 'alive' | 'dead' }>;
  pcDeaths?: string[];
  npcs: NPC[];
  locations: Location[];
  items: Item[];
  events: Event[];
  plotThreads: PlotThread[];
  cliffhanger: string;
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a D&D session scribe. Extract structured data from a session transcript.

Respond ONLY with valid JSON matching this exact shape (no markdown fences):
{
  "sessionTitle": "string — evocative title for this session",
  "sessionNumber": number,
  "summary": "string — 2-3 sentence narrative overview",
  "pcDeaths": ["character name"],
  "npcs": [{
    "name": "string",
    "role": "string — one line: what they are/do",
    "description": "string — appearance, personality, notable traits",
    "status": "alive|dead|unknown",
    "faction": "string or omit"
  }],
  "locations": [{
    "name": "string",
    "description": "string — what it looks/feels like",
    "significance": "string — why it mattered this session"
  }],
  "items": [{
    "name": "string",
    "description": "string",
    "holder": "string — who has it",
    "magical": true|false
  }],
  "events": [{
    "title": "string — short headline",
    "description": "string — 1-2 sentences of what happened",
    "type": "combat|discovery|death|revelation|social|travel"
  }],
  "plotThreads": [{
    "title": "string",
    "description": "string — what is unresolved or in motion",
    "status": "active|resolved|unresolved"
  }],
  "cliffhanger": "string — 2-3 vivid sentences describing the exact moment the session ended: where the party is, who or what threatens them, and what danger or mystery hangs over them. Be specific — name the location, the antagonist, the stakes."
}

Rules:
- The PC list is provided in the user message. PCs must NEVER appear in npcs[]. If a player character is a "new ally" they are still a PC — omit from npcs.
- A character rename (e.g. "Yannis → Apsnay Ickkay") means the same person with a new name — treat all references to either name as the same PC.
- pcDeaths: list only PCs who die permanently during this session. Empty array [] if none.
- Use in-world character names for events, npcs, items, and plotThreads
- events in chronological order, 6-12 entries
- npcs: only named NPCs (non-player characters) with meaningful screen time
- items: include mundane items only if plot-significant
- plotThreads: 3-6 threads that carry forward`;

// ─── Speakers helpers ─────────────────────────────────────────────────────────

interface ParsedSpeaker {
  character: string;
  previousName?: string;
  player: string;
}

function parseSpeakers(speakerMap: Record<string, string>): ParsedSpeaker[] {
  return Object.values(speakerMap)
    .filter(display => !display.trimStart().toLowerCase().startsWith('dm ') && !display.includes(' / '))
    .map(display => {
      // Format: "CharacterName (PlayerName)" or "OldName → NewName (PlayerName)"
      const playerMatch = display.match(/\(([^)]+)\)$/);
      const player = playerMatch?.[1] ?? display;
      const namePart = display.replace(/\s*\([^)]+\)$/, '').trim();
      if (namePart.includes('→')) {
        const [prev, current] = namePart.split('→').map(s => s.trim());
        return { character: current, previousName: prev, player };
      }
      return { character: namePart, player };
    });
}

function buildPcContext(speakers: ParsedSpeaker[]): string {
  const lines = speakers.map(s => {
    const rename = s.previousName ? `, previously known as ${s.previousName}` : '';
    return `- ${s.character}${rename} (player: ${s.player})`;
  });
  return `Player characters (PCs) in this session — these are players, NOT NPCs:\n${lines.join('\n')}`;
}

function buildPartyFromSpeakers(
  speakers: ParsedSpeaker[],
  pcDeaths: string[] = [],
): Array<{ character: string; player: string; status: 'alive' | 'dead' }> {
  const deathSet = new Set(pcDeaths.map(n => n.toLowerCase()));
  return speakers.map(s => ({
    character: s.character,
    player: s.player,
    status: deathSet.has(s.character.toLowerCase()) ? 'dead' : 'alive',
  }));
}

// ─── Hugo frontmatter ─────────────────────────────────────────────────────────

function buildFrontmatter(data: SessionData, campaignName: string): string {
  const ys = (v: string) => JSON.stringify(v);
  const lines: string[] = ['---'];

  lines.push(`title: ${ys(data.sessionTitle)}`);
  lines.push(`campaign: ${ys(campaignName)}`);
  lines.push(`session_number: ${data.sessionNumber}`);
  lines.push(`date: "${new Date().toISOString().split('T')[0]}"`);
  lines.push(`summary: ${ys(data.summary)}`);
  lines.push(`cliffhanger: ${ys(data.cliffhanger)}`);

  if (data.party.length > 0) {
    lines.push('party:');
    for (const p of data.party) {
      lines.push(`  - character: ${ys(p.character)}`);
      lines.push(`    player: ${ys(p.player)}`);
      lines.push(`    status: ${p.status}`);
    }
  }

  if (data.npcs.length > 0) {
    lines.push('npcs:');
    for (const n of data.npcs) {
      lines.push(`  - name: ${ys(n.name)}`);
      lines.push(`    role: ${ys(n.role)}`);
      lines.push(`    description: ${ys(n.description)}`);
      lines.push(`    status: ${n.status}`);
      if (n.faction) lines.push(`    faction: ${ys(n.faction)}`);
    }
  }

  if (data.locations.length > 0) {
    lines.push('locations:');
    for (const l of data.locations) {
      lines.push(`  - name: ${ys(l.name)}`);
      lines.push(`    description: ${ys(l.description)}`);
      lines.push(`    significance: ${ys(l.significance)}`);
    }
  }

  if (data.items.length > 0) {
    lines.push('items:');
    for (const i of data.items) {
      lines.push(`  - name: ${ys(i.name)}`);
      lines.push(`    description: ${ys(i.description)}`);
      lines.push(`    holder: ${ys(i.holder)}`);
      lines.push(`    magical: ${i.magical}`);
    }
  }

  if (data.events.length > 0) {
    lines.push('events:');
    for (const e of data.events) {
      lines.push(`  - title: ${ys(e.title)}`);
      lines.push(`    description: ${ys(e.description)}`);
      lines.push(`    type: ${e.type}`);
    }
  }

  if (data.plotThreads.length > 0) {
    lines.push('plot_threads:');
    for (const t of data.plotThreads) {
      lines.push(`  - title: ${ys(t.title)}`);
      lines.push(`    description: ${ys(t.description)}`);
      lines.push(`    status: ${t.status}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

// ─── PDF template ─────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  combat: '⚔️', discovery: '🔍', death: '💀',
  revelation: '✨', social: '💬', travel: '🗺️',
};
const EVENT_COLORS: Record<string, string> = {
  combat: '#7f1d1d', discovery: '#1e3a5f', death: '#374151',
  revelation: '#3b1f6e', social: '#1a3a2a', travel: '#1c3040',
};
const STATUS_COLORS: Record<string, string> = {
  alive: '#16a34a', dead: '#dc2626', unknown: '#9ca3af',
};
const THREAD_COLORS: Record<string, string> = {
  active: '#d97706', resolved: '#16a34a', unresolved: '#dc2626',
};

function buildPdfHtml(data: SessionData): string {
  const badge = (label: string, color: string) =>
    `<span class="badge" style="background:${color}22;color:${color};border-color:${color}44">${label}</span>`;

  const partyRows = data.party.map(p => `
    <tr>
      <td class="bold">${p.character}</td>
      <td class="muted">${p.player}</td>
      <td>${badge(p.status.toUpperCase(), STATUS_COLORS[p.status] ?? '#9ca3af')}</td>
    </tr>`).join('');

  const npcCards = data.npcs.map(n => `
    <div class="npc-card">
      <div class="npc-header">
        <span class="npc-name">${n.name}</span>
        ${badge(n.status.toUpperCase(), STATUS_COLORS[n.status] ?? '#9ca3af')}
      </div>
      <div class="npc-role">${n.role}${n.faction ? ` · <em>${n.faction}</em>` : ''}</div>
      <div class="npc-desc">${n.description}</div>
    </div>`).join('');

  const locationCards = data.locations.map(l => `
    <div class="location-card">
      <div class="location-name">📍 ${l.name}</div>
      <div class="location-desc">${l.description}</div>
      <div class="location-sig"><em>${l.significance}</em></div>
    </div>`).join('');

  const itemRows = data.items.map(i => `
    <tr>
      <td class="bold">${i.magical ? '✦ ' : ''}${i.name}</td>
      <td>${i.description}</td>
      <td class="muted">${i.holder}</td>
    </tr>`).join('');

  const events = data.events.map(e => `
    <div class="event" style="border-left-color:${EVENT_COLORS[e.type] ?? '#4b5563'}">
      <div class="event-header">
        <span>${EVENT_ICONS[e.type] ?? '•'}</span>
        <span class="event-title">${e.title}</span>
        <span class="event-type">${e.type}</span>
      </div>
      <div class="event-desc">${e.description}</div>
    </div>`).join('');

  const threads = data.plotThreads.map(t => `
    <div class="thread">
      <div class="thread-header">
        <span class="thread-title">${t.title}</span>
        ${badge(t.status.toUpperCase(), THREAD_COLORS[t.status] ?? '#9ca3af')}
      </div>
      <div class="thread-desc">${t.description}</div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Crimson Text',Georgia,serif;background:#0f0e17;color:#e8e0d0;font-size:13px;line-height:1.6;padding:48px 56px}
.campaign-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.2em;color:#f59e0b99;text-transform:uppercase;margin-bottom:8px}
.session-title{font-family:'Cinzel',serif;font-size:28px;font-weight:700;color:#fcd34d;margin-bottom:12px}
.session-summary{color:#b8b0a0;font-style:italic;font-size:14px;max-width:680px}
.doc-header{border-bottom:1px solid #f59e0b44;padding-bottom:24px;margin-bottom:36px}
.section{margin-bottom:36px}
.section-heading{font-family:'Cinzel',serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#f59e0b;border-bottom:1px solid #f59e0b33;padding-bottom:6px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:left;padding:6px 10px;border-bottom:1px solid #374151}
td{padding:8px 10px;border-bottom:1px solid #1f2937;vertical-align:top;color:#d1c9b8}
tr:last-child td{border-bottom:none}
.bold{font-weight:600;color:#e8e0d0}.muted{color:#6b7280}
.badge{display:inline-block;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;padding:2px 7px;border-radius:3px;border:1px solid;font-weight:600}
.npc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.npc-card{background:#161420;border:1px solid #2d2b3a;border-radius:6px;padding:14px}
.npc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
.npc-name{font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:#e8e0d0}
.npc-role{color:#f59e0b;font-size:11px;margin-bottom:6px}.npc-desc{color:#9ca3af;font-size:12px}
.location-card{background:#161420;border:1px solid #2d2b3a;border-left:3px solid #f59e0b55;border-radius:4px;padding:12px 14px;margin-bottom:10px}
.location-name{font-family:'Cinzel',serif;font-size:12px;color:#fcd34d;margin-bottom:4px}
.location-desc{color:#d1c9b8;margin-bottom:4px}.location-sig{color:#9ca3af;font-size:12px}
.event{border-left:3px solid;padding:10px 14px;margin-bottom:10px;background:#161420;border-radius:0 4px 4px 0}
.event-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.event-title{font-family:'Cinzel',serif;font-size:12px;color:#e8e0d0;flex:1}
.event-type{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-family:'Cinzel',serif}
.event-desc{color:#9ca3af;font-size:12px}
.thread{background:#161420;border:1px solid #2d2b3a;border-radius:4px;padding:12px 14px;margin-bottom:10px}
.thread-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.thread-title{font-family:'Cinzel',serif;font-size:12px;color:#e8e0d0}
.thread-desc{color:#9ca3af;font-size:12px}
.cliffhanger-box{background:#1a0a0a;border:1px solid #7f1d1d55;border-left:3px solid #dc2626;border-radius:4px;padding:16px 20px;color:#fca5a5;font-style:italic;font-size:14px;line-height:1.7}
.doc-footer{margin-top:48px;padding-top:16px;border-top:1px solid #f59e0b22;display:flex;justify-content:space-between;color:#4b5563;font-size:10px;font-family:'Cinzel',serif;letter-spacing:.08em}
</style></head><body>
<div class="doc-header">
  <div class="campaign-label">Session Report</div>
  <div class="session-title">${data.sessionTitle}</div>
  <div class="session-summary">${data.summary}</div>
</div>
<div class="section"><div class="section-heading">The Party</div>
  <table><thead><tr><th>Character</th><th>Player</th><th>Status</th></tr></thead><tbody>${partyRows}</tbody></table>
</div>
<div class="section"><div class="section-heading">Session Timeline</div>${events}</div>
<div class="section"><div class="section-heading">NPCs Encountered</div><div class="npc-grid">${npcCards}</div></div>
<div class="section"><div class="section-heading">Locations</div>${locationCards}</div>
<div class="section"><div class="section-heading">Items &amp; Loot</div>
  <table><thead><tr><th>Item</th><th>Description</th><th>Held By</th></tr></thead><tbody>${itemRows}</tbody></table>
</div>
<div class="section"><div class="section-heading">Active Plot Threads</div>${threads}</div>
<div class="section"><div class="section-heading">Where We Left Off</div>
  <div class="cliffhanger-box">${data.cliffhanger}</div>
</div>
<div class="doc-footer">
  <span>Generated by QuiverDM</span>
  <span>${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
</div>
</body></html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2] ?? 'e:/Projects/QuiverDM/docs/Test/transcription/Jordans 2nd Campaign/0.2';
  const transcriptPath = path.join(dir, 'master-transcript.md');

  if (!fs.existsSync(transcriptPath)) {
    console.error('master-transcript.md not found:', transcriptPath);
    process.exit(1);
  }

  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  console.log(`Transcript: ${transcript.length} chars`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error('No OPENAI_API_KEY'); process.exit(1); }
  const client = new OpenAI({ apiKey });

  // Load speakers.json for PC list
  const speakersPath = path.join(dir, 'speakers.json');
  const rawSpeakerMap: Record<string, string> = fs.existsSync(speakersPath)
    ? JSON.parse(fs.readFileSync(speakersPath, 'utf8'))
    : {};
  const parsedSpeakers = parseSpeakers(rawSpeakerMap);
  const pcContext = parsedSpeakers.length > 0 ? buildPcContext(parsedSpeakers) : '';

  console.log('Extracting session data via GPT-4o...');
  const userMessage = pcContext
    ? `${pcContext}\n\nSession transcript:\n\n${transcript}`
    : `Session transcript:\n\n${transcript}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 3000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  let raw = (response.choices[0]?.message?.content ?? '').trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  const aiData: Omit<SessionData, 'party'> & { pcDeaths?: string[] } = JSON.parse(raw);

  // Build party from speakers.json — AI only reports deaths
  const party = parsedSpeakers.length > 0
    ? buildPartyFromSpeakers(parsedSpeakers, aiData.pcDeaths ?? [])
    : [];

  const VALID_EVENT_TYPES = new Set(['combat', 'discovery', 'death', 'revelation', 'social', 'travel']);
  const events = (aiData.events ?? []).map(e => ({
    ...e,
    type: VALID_EVENT_TYPES.has(e.type) ? e.type : 'revelation' as Event['type'],
  }));

  const data: SessionData = { ...aiData, party, events };
  console.log(`Extracted: ${data.npcs.length} NPCs, ${data.locations.length} locations, ${data.items.length} items, ${data.events.length} events`);

  // 1. Raw JSON
  const jsonPath = path.join(dir, 'session-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  // 2. Hugo Markdown
  const campaignName = path.basename(path.dirname(dir));
  const hugoSiteDir  = path.resolve(__dirname, '..', 'docs', 'campaign-site');
  const sessionsDir  = path.join(hugoSiteDir, 'content', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const slug   = `session-${data.sessionNumber}`;
  const mdPath = path.join(sessionsDir, `${slug}.md`);
  fs.writeFileSync(mdPath, buildFrontmatter(data, campaignName) + '\n', 'utf8');
  console.log(`Wrote Hugo content: ${mdPath}`);

  // 3. Build Hugo site
  console.log('Building Hugo site...');
  const hugoExe = process.platform === 'win32'
    ? 'C:/Users/mail/AppData/Local/Microsoft/WinGet/Packages/Hugo.Hugo.Extended_Microsoft.Winget.Source_8wekyb3d8bbwe/hugo.exe'
    : 'hugo';
  const hugoBuild = spawnSync(hugoExe, ['--source', hugoSiteDir, '--minify'], { stdio: 'inherit' });
  if (hugoBuild.status !== 0) {
    console.error('Hugo build failed');
    process.exit(1);
  }
  console.log(`Site: ${hugoSiteDir}/public/`);

  // 4. PDF via Playwright
  console.log('Rendering PDF...');
  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setContent(buildPdfHtml(data), { waitUntil: 'networkidle' });
  const pdfPath = path.join(dir, 'session-report.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' }, printBackground: true });
  await browser.close();

  console.log(`\nWrote: ${jsonPath}`);
  console.log(`Wrote: ${pdfPath}`);
  console.log('Done.\n');
  console.log(`Preview: hugo server --source "${hugoSiteDir}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
