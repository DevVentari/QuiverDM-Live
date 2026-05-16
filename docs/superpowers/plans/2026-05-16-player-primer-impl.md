# Player Primer Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two one-shot scripts that pull a Session 0 transcript from the DB, extract world/lore/mechanic data via Claude, and render a dark-atmospheric player primer PDF.

**Architecture:** Script 1 (`extract-player-primer.ts`) queries Prisma for transcript rawText → Claude Sonnet extraction → writes `player-primer.json`. Script 2 (`render-player-primer.ts`) reads JSON → builds HTML → Playwright PDF. Both read from `.env` (homelab DB).

**Tech Stack:** TypeScript, tsx, Prisma, `@anthropic-ai/sdk`, Playwright chromium, dotenv

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `scripts/extract-player-primer.ts` | Create | Fetch transcript from DB, run Claude, write JSON |
| `scripts/render-player-primer.ts` | Create | Read JSON, build HTML, render PDF via Playwright |

---

## Task 1: Write `scripts/extract-player-primer.ts`

**Files:**
- Create: `scripts/extract-player-primer.ts`

- [ ] **Step 1: Create the extraction script**

```typescript
/**
 * Extract a player primer from a Session 0 transcript via Claude.
 *
 * Usage:
 *   npx tsx scripts/extract-player-primer.ts \
 *     --campaign-slug jordans-campaign \
 *     [--session-number 0] \
 *     [--out docs/Jordan-New-Campaign]
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/lib/prisma';

const { values: args } = parseArgs({
  options: {
    'campaign-slug':  { type: 'string', default: 'jordans-campaign' },
    'session-number': { type: 'string', default: '0' },
    'out':            { type: 'string', default: 'docs/Jordan-New-Campaign' },
  },
});

const campaignSlug  = args['campaign-slug']!;
const sessionNumber = parseInt(args['session-number']!, 10);
const outDir        = path.resolve(process.cwd(), args['out']!);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerPrimer {
  campaignName: string;
  generatedAt: string;

  worldOverview: {
    name: string;
    tagline: string;
    tone: string;
    history: string;
    cosmology: string;
  };

  whatYouKnow: Array<{
    topic: string;
    detail: string;
    confidence: 'established' | 'rumored';
  }>;

  factions: Array<{
    name: string;
    description: string;
    playerRelationship: 'ally' | 'neutral' | 'antagonist' | 'unknown';
    notes: string;
  }>;

  locations: Array<{
    name: string;
    description: string;
    significance: string;
  }>;

  characterGuide: {
    overview: string;
    recommendedClasses: Array<{ class: string; why: string }>;
    recommendedBackgrounds: Array<{ background: string; why: string }>;
    themes: string[];
    warnings: string[];
  };

  mechanics: Array<{
    name: string;
    description: string;
    type: 'house_rule' | 'custom_mechanic' | 'variant_rule';
  }>;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a campaign scribe for a tabletop RPG. Extract structured information from this Session 0 transcript.

Session 0 is the campaign kickoff: the DM introduces the world, players ask questions, character concepts are discussed, and house rules are established.

Respond ONLY with valid JSON matching this exact shape (no markdown fences, no extra keys):

{
  "campaignName": "string — the campaign or world name as the DM describes it",
  "worldOverview": {
    "name": "string — the world or setting name",
    "tagline": "string — one evocative sentence capturing the world's essence",
    "tone": "string — e.g. 'gritty survival horror', 'dark heroic fantasy', 'political intrigue'",
    "history": "string — 2-3 paragraphs of established world history and context, written as player-facing prose",
    "cosmology": "string — gods, magic system, planes if discussed; empty string if not mentioned"
  },
  "whatYouKnow": [
    {
      "topic": "string — short topic name, e.g. 'The Demon War', 'The Night Cycle'",
      "detail": "string — factual paragraph of what players now know about this topic",
      "confidence": "established | rumored"
    }
  ],
  "factions": [
    {
      "name": "string",
      "description": "string — who they are and what they want",
      "playerRelationship": "ally | neutral | antagonist | unknown",
      "notes": "string — how players should think about this faction"
    }
  ],
  "locations": [
    {
      "name": "string",
      "description": "string — what it is like",
      "significance": "string — why it matters to the players"
    }
  ],
  "characterGuide": {
    "overview": "string — 1-2 sentences on what kinds of characters fit this world",
    "recommendedClasses": [{ "class": "string", "why": "string — 1 sentence" }],
    "recommendedBackgrounds": [{ "background": "string", "why": "string — 1 sentence" }],
    "themes": ["string — motivations or themes that resonate with this setting"],
    "warnings": ["string — things the DM said may not fit, or preferences stated about the campaign"]
  },
  "mechanics": [
    {
      "name": "string — rule name",
      "description": "string — what the rule does and how it works",
      "type": "house_rule | custom_mechanic | variant_rule"
    }
  ]
}

Rules:
- Extract only what is stated in the transcript — do not invent
- "established" = stated as fact by the DM; "rumored" = mentioned as uncertain, legend, or in-world hearsay
- characterGuide must be grounded in what the DM said, not generic advice
- If a section has nothing to extract, use an empty array []
- cosmology: empty string if not discussed
- whatYouKnow: aim for 4-10 items covering the major topics the DM explained
- factions: only groups specifically named and described
- mechanics: include any rules deviations, custom systems, or house rules the DM mentioned`;

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Fetch transcript from DB
  const campaign = await prisma.campaign.findUnique({ where: { slug: campaignSlug } });
  if (!campaign) throw new Error(`Campaign not found: ${campaignSlug}`);
  console.log(`Campaign: ${campaign.name} (${campaign.id})`);

  const session = await prisma.gameSession.findUnique({
    where: { campaignId_sessionNumber: { campaignId: campaign.id, sessionNumber } },
  });
  if (!session) throw new Error(`Session ${sessionNumber} not found in campaign ${campaignSlug}`);
  console.log(`Session: ${session.title} (${session.id})`);

  const transcript = await prisma.transcript.findFirst({
    where: { sessionId: session.id },
    select: { id: true, rawText: true },
  });
  if (!transcript?.rawText) throw new Error(`No transcript found for session ${session.id}`);
  console.log(`Transcript: ${transcript.id} (${transcript.rawText.length} chars)`);

  // 2. Extract via Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const client = new Anthropic({ apiKey });
  console.log('Extracting via Claude Sonnet...');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: [{ type: 'text', text: SYSTEM_PROMPT }],
    messages: [{ role: 'user', content: `Session transcript:\n\n${transcript.rawText}` }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');

  let raw = block.text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  const extracted = JSON.parse(raw) as Omit<PlayerPrimer, 'generatedAt'>;

  const primer: PlayerPrimer = {
    ...extracted,
    campaignName: extracted.campaignName || campaign.name,
    generatedAt: new Date().toISOString(),
  };

  console.log(`Extracted: ${primer.whatYouKnow.length} facts, ${primer.factions.length} factions, ${primer.locations.length} locations, ${primer.mechanics.length} mechanics`);

  // 3. Write JSON
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'player-primer.json');
  fs.writeFileSync(jsonPath, JSON.stringify(primer, null, 2), 'utf8');
  console.log(`\nWrote: ${jsonPath}`);
  console.log('Next: npx tsx scripts/render-player-primer.ts ' + args['out']!);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Run extraction**

```powershell
cd E:\Projects\QuiverDM
npx tsx scripts/extract-player-primer.ts --campaign-slug jordans-campaign --out docs/Jordan-New-Campaign
```

Expected output:
```
Campaign: Jordan's Campaign (cmp8681bt0001vhe1nng05f4n)
Session: Session 0 (cmp8681g30005vhe123rytkc6)
Transcript: cmp86w82f0001guq587adyht4 (NNNNN chars)
Extracting via Claude Sonnet...
Extracted: N facts, N factions, N locations, N mechanics
Wrote: E:\Projects\QuiverDM\docs\Jordan-New-Campaign\player-primer.json
```

- [ ] **Step 3: Verify JSON structure**

```powershell
Get-Content "E:\Projects\QuiverDM\docs\Jordan-New-Campaign\player-primer.json" | ConvertFrom-Json | Select-Object campaignName, generatedAt, @{N='facts';E={$_.whatYouKnow.Count}}, @{N='factions';E={$_.factions.Count}}, @{N='locations';E={$_.locations.Count}}, @{N='mechanics';E={$_.mechanics.Count}}
```

Expected: all counts > 0, campaignName and generatedAt populated.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-player-primer.ts docs/Jordan-New-Campaign/player-primer.json
git commit -m "feat(primer): extract Jordan Session 0 player primer JSON via Claude"
```

---

## Task 2: Write `scripts/render-player-primer.ts`

**Files:**
- Create: `scripts/render-player-primer.ts`

- [ ] **Step 1: Create the render script**

```typescript
/**
 * Render a player-primer.json as a PDF.
 *
 * Usage:
 *   npx tsx scripts/render-player-primer.ts [docs/Jordan-New-Campaign]
 */

import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright';
import type { PlayerPrimer } from './extract-player-primer';

const dir      = process.argv[2] ?? 'docs/Jordan-New-Campaign';
const jsonPath = path.resolve(process.cwd(), dir, 'player-primer.json');
const pdfPath  = path.resolve(process.cwd(), dir, 'player-primer.pdf');

if (!fs.existsSync(jsonPath)) {
  console.error('player-primer.json not found:', jsonPath);
  process.exit(1);
}

const data: PlayerPrimer = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ─── HTML builder ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prose(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('');
}

const FACTION_CLASS: Record<string, string> = {
  ally: 'ally', neutral: 'neutral', antagonist: 'antagonist', unknown: 'unknown',
};

const MECHANIC_LABEL: Record<string, string> = {
  house_rule: 'House Rule', custom_mechanic: 'Custom Mechanic', variant_rule: 'Variant Rule',
};

function buildHtml(d: PlayerPrimer): string {
  const dateStr = new Date(d.generatedAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const knowHtml = d.whatYouKnow.map(k => `
    <div class="knowledge-item">
      <div class="knowledge-topic">
        ${esc(k.topic)}
        <span class="badge badge-${k.confidence}">${k.confidence}</span>
      </div>
      <div class="knowledge-detail">${esc(k.detail)}</div>
    </div>`).join('');

  const factionHtml = d.factions.map(f => `
    <div class="faction-card ${FACTION_CLASS[f.playerRelationship] ?? 'unknown'}">
      <div class="faction-header">
        <span class="faction-name">${esc(f.name)}</span>
        <span class="faction-rel">${f.playerRelationship}</span>
      </div>
      <div class="faction-desc">${esc(f.description)}</div>
      ${f.notes ? `<div class="faction-notes">${esc(f.notes)}</div>` : ''}
    </div>`).join('');

  const locationHtml = d.locations.map(l => `
    <div class="location-item">
      <div class="location-name">${esc(l.name)}</div>
      <div class="location-desc">${esc(l.description)}</div>
      <div class="location-sig">${esc(l.significance)}</div>
    </div>`).join('');

  const classHtml = d.characterGuide.recommendedClasses.map(c => `
    <div class="guide-row">
      <span class="guide-name">${esc(c.class)}</span>
      <span class="guide-why">${esc(c.why)}</span>
    </div>`).join('');

  const bgHtml = d.characterGuide.recommendedBackgrounds.map(b => `
    <div class="guide-row">
      <span class="guide-name">${esc(b.background)}</span>
      <span class="guide-why">${esc(b.why)}</span>
    </div>`).join('');

  const themesHtml = d.characterGuide.themes.map(t =>
    `<span class="theme-tag">${esc(t)}</span>`).join('');

  const warningsHtml = d.characterGuide.warnings.map(w =>
    `<div class="warning-item">${esc(w)}</div>`).join('');

  const mechanicsHtml = d.mechanics.map(m => `
    <div class="mechanic-item ${m.type}">
      <div class="mechanic-header">
        <span class="mechanic-name">${esc(m.name)}</span>
        <span class="mechanic-type">${MECHANIC_LABEL[m.type] ?? m.type}</span>
      </div>
      <div class="mechanic-desc">${esc(m.description)}</div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Crimson Text',Georgia,serif;background:#0f0e17;color:#e8e0d0;font-size:13.5px;line-height:1.7;padding:56px 64px}

/* Cover */
.cover{border-bottom:2px solid #f59e0b55;padding-bottom:32px;margin-bottom:48px}
.cover-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.22em;color:#f59e0b88;text-transform:uppercase;margin-bottom:10px}
.cover-title{font-family:'Cinzel',serif;font-size:36px;font-weight:700;color:#fcd34d;margin-bottom:8px}
.cover-tagline{font-style:italic;color:#b8b0a0;font-size:16px;margin-bottom:16px}
.cover-meta{font-family:'Cinzel',serif;font-size:10px;color:#4b5563;letter-spacing:.12em}

/* Sections */
.section{margin-bottom:44px}
.section-heading{font-family:'Cinzel',serif;font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#f59e0b;border-bottom:1px solid #f59e0b33;padding-bottom:6px;margin-bottom:20px}

/* World */
.tone-label{display:inline-block;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.1em;color:#9ca3af;border:1px solid #374151;padding:2px 8px;border-radius:2px;margin-bottom:16px}
.prose p{color:#d1c9b8;margin-bottom:12px}

/* What You Know */
.knowledge-item{margin-bottom:22px}
.knowledge-topic{font-family:'Cinzel',serif;font-size:13px;color:#fcd34d;margin-bottom:5px;display:flex;align-items:center;gap:10px}
.knowledge-detail{color:#c0b8a8;padding-left:14px;border-left:2px solid #f59e0b22}
.badge{font-family:'Cinzel',serif;font-size:8px;letter-spacing:.08em;padding:1px 6px;border-radius:2px;border:1px solid}
.badge-established{background:#f59e0b11;color:#f59e0b;border-color:#f59e0b44}
.badge-rumored{background:transparent;color:#6b7280;border-color:#374151}

/* Factions — only section with card backgrounds */
.faction-card{background:#161420;border:1px solid #2d2b3a;border-radius:4px;padding:14px 16px;margin-bottom:12px;border-left-width:3px}
.faction-card.ally{border-left-color:#16a34a}
.faction-card.neutral{border-left-color:#4b5563}
.faction-card.antagonist{border-left-color:#dc2626}
.faction-card.unknown{border-left-color:#7c3aed}
.faction-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.faction-name{font-family:'Cinzel',serif;font-size:13px;color:#e8e0d0}
.faction-rel{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
.faction-desc{color:#9ca3af;font-size:12px;margin-bottom:4px}
.faction-notes{color:#c0b8a8;font-size:12px;font-style:italic}

/* Locations */
.location-item{margin-bottom:18px}
.location-name{font-family:'Cinzel',serif;font-size:13px;color:#fcd34d;margin-bottom:3px}
.location-desc{color:#c0b8a8;padding-left:14px}
.location-sig{color:#9ca3af;font-size:12px;padding-left:14px;font-style:italic;margin-top:2px}

/* Character Guide */
.guide-overview{color:#d1c9b8;margin-bottom:20px}
.guide-group-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;margin-top:18px}
.guide-row{display:flex;gap:12px;align-items:baseline;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #1f2937}
.guide-row:last-child{border-bottom:none}
.guide-name{font-family:'Cinzel',serif;font-size:12px;color:#e8e0d0;min-width:170px;flex-shrink:0}
.guide-why{color:#9ca3af;font-size:12px}
.themes-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.theme-tag{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;color:#d97706;border:1px solid #d9770644;padding:2px 8px;border-radius:2px}
.warnings-list{margin-top:14px}
.warning-item{color:#9ca3af;font-size:12px;padding-left:16px;position:relative;margin-bottom:5px}
.warning-item::before{content:'—';position:absolute;left:0;color:#4b5563}

/* Mechanics — left-border only, no card fill */
.mechanic-item{border-left:3px solid;padding:10px 14px;margin-bottom:12px}
.mechanic-item.house_rule{border-left-color:#f59e0b}
.mechanic-item.custom_mechanic{border-left-color:#6366f1}
.mechanic-item.variant_rule{border-left-color:#4b5563}
.mechanic-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.mechanic-name{font-family:'JetBrains Mono',monospace;font-size:11px;color:#e8e0d0}
.mechanic-type{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase}
.mechanic-desc{color:#9ca3af;font-size:12px}

/* Footer */
.doc-footer{margin-top:56px;padding-top:16px;border-top:1px solid #f59e0b22;display:flex;justify-content:space-between;color:#4b5563;font-size:10px;font-family:'Cinzel',serif;letter-spacing:.08em}
</style></head><body>

<div class="cover">
  <div class="cover-label">Player's Primer</div>
  <div class="cover-title">${esc(d.worldOverview.name)}</div>
  <div class="cover-tagline">${esc(d.worldOverview.tagline)}</div>
  <div class="cover-meta">${esc(d.campaignName)} &middot; ${dateStr}</div>
</div>

<div class="section">
  <div class="section-heading">The World</div>
  <div class="tone-label">${esc(d.worldOverview.tone)}</div>
  <div class="prose">${prose(d.worldOverview.history)}${d.worldOverview.cosmology ? prose(d.worldOverview.cosmology) : ''}</div>
</div>

${d.whatYouKnow.length > 0 ? `
<div class="section">
  <div class="section-heading">What You Know</div>
  ${knowHtml}
</div>` : ''}

${d.factions.length > 0 ? `
<div class="section">
  <div class="section-heading">Factions &amp; Powers</div>
  ${factionHtml}
</div>` : ''}

${d.locations.length > 0 ? `
<div class="section">
  <div class="section-heading">Known Locations</div>
  ${locationHtml}
</div>` : ''}

<div class="section">
  <div class="section-heading">Creating Your Character</div>
  <div class="guide-overview">${esc(d.characterGuide.overview)}</div>
  ${d.characterGuide.recommendedClasses.length > 0 ? `
  <div class="guide-group-label">Recommended Classes</div>
  ${classHtml}` : ''}
  ${d.characterGuide.recommendedBackgrounds.length > 0 ? `
  <div class="guide-group-label">Recommended Backgrounds</div>
  ${bgHtml}` : ''}
  ${d.characterGuide.themes.length > 0 ? `
  <div class="guide-group-label">Themes &amp; Motivations</div>
  <div class="themes-list">${themesHtml}</div>` : ''}
  ${d.characterGuide.warnings.length > 0 ? `
  <div class="warnings-list">${warningsHtml}</div>` : ''}
</div>

${d.mechanics.length > 0 ? `
<div class="section">
  <div class="section-heading">How We Play</div>
  ${mechanicsHtml}
</div>` : ''}

<div class="doc-footer">
  <span>QuiverDM &middot; Player's Primer</span>
  <span>${dateStr}</span>
</div>

</body></html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const html    = buildHtml(data);
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  console.log('Rendering PDF...');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path:            pdfPath,
    format:          'A4',
    printBackground: true,
    margin:          { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();

  console.log(`Wrote: ${pdfPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the render**

```powershell
cd E:\Projects\QuiverDM
npx tsx scripts/render-player-primer.ts docs/Jordan-New-Campaign
```

Expected output:
```
Rendering PDF...
Wrote: E:\Projects\QuiverDM\docs\Jordan-New-Campaign\player-primer.pdf
```

- [ ] **Step 3: Open and inspect the PDF**

```powershell
Start-Process "E:\Projects\QuiverDM\docs\Jordan-New-Campaign\player-primer.pdf"
```

Check:
- Cover block renders (world name, tagline, campaign name, date)
- "The World" section has prose paragraphs, tone label
- "What You Know" entries show topic headings with established/rumored badges
- Factions section uses card backgrounds with colour-coded left borders
- Locations, Character Guide, Mechanics render cleanly without excess card fills
- No sections blank (if any are, check player-primer.json for empty arrays)

- [ ] **Step 4: Commit**

```bash
git add scripts/render-player-primer.ts docs/Jordan-New-Campaign/player-primer.pdf
git commit -m "feat(primer): render Jordan Session 0 player primer PDF"
```

---

## Self-Review Notes

- Spec section `worldOverview.cosmology` → optional in HTML (guarded with `d.worldOverview.cosmology ? ...`). ✓
- All sections guarded by `.length > 0` so empty arrays produce no broken markup. ✓
- `esc()` applied to all user-sourced strings before insertion into HTML. ✓
- `PlayerPrimer` type exported from extraction script and imported by render script — no duplication. ✓
- `.env` loaded via `dotenv.config()` in extraction script; render script needs no DB, so no dotenv needed. ✓
- `prose()` handles multi-paragraph history by splitting on `\n\n`. ✓
- Playwright `waitUntil: 'networkidle'` ensures Google Fonts load before PDF capture. ✓
