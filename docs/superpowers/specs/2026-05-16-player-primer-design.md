# Player Primer Generator — Design Spec

**Date:** 2026-05-16
**Status:** Approved

## Overview

Two-shot script pipeline that extracts a structured player primer from a Session 0 transcript and renders it as a beautifully formatted PDF. No narrative tone — factual, reference-style document for players.

**Input:** Jordan's Campaign Session 0 transcript (already in DB, id: `cmp86w82f0001guq587adyht4`)
**Output:** `docs/Jordan-New-Campaign/player-primer.json` + `docs/Jordan-New-Campaign/player-primer.pdf`

---

## Script 1 — `scripts/extract-player-primer.ts`

Fetches the full transcript from the homelab DB (`DATABASE_URL` from `.env`), runs Claude extraction, writes JSON.

### Lookup

```
campaign slug: "jordans-campaign"
→ gameSessions[sessionNumber: 0]
→ transcripts[0].rawText
```

Falls back to `--transcript-id` CLI flag if slug lookup fails.

### Claude Extraction

Model: `claude-opus-4-7` (via `chatWithAI` with `forceProvider: 'claude'`)
Prompt: system + user (rawText). Returns JSON only — no markdown fences.

### Output Schema — `PlayerPrimer`

```typescript
interface PlayerPrimer {
  campaignName: string;
  generatedAt: string; // ISO date

  worldOverview: {
    name: string;         // world/setting name
    tagline: string;      // one evocative sentence
    tone: string;         // e.g. "gritty survival horror", "dark heroic"
    history: string;      // 2-3 paragraphs of established history
    cosmology: string;    // gods, planes, magic system if mentioned
  };

  whatYouKnow: Array<{
    topic: string;        // e.g. "The Demon War", "The Night Cycle"
    detail: string;       // factual paragraph
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
    overview: string;     // what kinds of characters fit this world
    recommendedClasses: Array<{ class: string; why: string }>;
    recommendedBackgrounds: Array<{ background: string; why: string }>;
    themes: string[];     // motivations that resonate with the setting
    warnings: string[];   // things that may not fit / DM preferences stated
  };

  mechanics: Array<{
    name: string;
    description: string;
    type: 'house_rule' | 'custom_mechanic' | 'variant_rule';
  }>;
}
```

### CLI

```bash
npx tsx scripts/extract-player-primer.ts --campaign-slug jordans-campaign [--session-number 0] [--out docs/Jordan-New-Campaign]
```

---

## Script 2 — `scripts/render-player-primer.ts`

Reads `player-primer.json`, builds HTML, renders PDF via Playwright.

### CLI

```bash
npx tsx scripts/render-player-primer.ts [docs/Jordan-New-Campaign]
```

### PDF Layout

**Page feel:** Dark atmospheric (same base as `generate-session-report.ts`). Cinzel for all headings, Crimson Text body, JetBrains Mono for stats/mechanics names.

**Sections in order:**
1. **Cover block** — campaign name, world tagline, generation date. Amber decorative rule.
2. **The World** — worldOverview.history + cosmology as flowing prose. Tone displayed as a small label, not a card.
3. **What You Know** — clean list layout: topic in Cinzel as a subheading, detail as body text below, `established`/`rumored` as an inline badge. No card backgrounds.
4. **Factions** — only here use subtle card background (one per faction), colour-accented left border: ally (green), neutral (grey), antagonist (red), unknown (purple). Keep padding tight.
5. **Locations** — simple definition-list style: name in amber Cinzel, description + significance as indented text. No card backgrounds.
6. **Creating Your Character** — overview prose, then two plain sections (classes, backgrounds) as styled list rows with sub-text reasons. No grid of cards.
7. **How We Play** — mechanics as bordered rule blocks (left-border only, no full card fill). `house_rule` amber, `custom_mechanic` indigo, `variant_rule` grey border.

**Format:** A4, dark background, print-background true, zero margin (padding inside HTML).

---

## Constraints

- Scripts are one-shot / offline — no BullMQ, no queuing
- `chatWithAI` with `forceProvider: 'claude'` for extraction quality
- Load `.env` via `dotenv.config()` (homelab DB, not `.env.local`)
- No backwards compat shims — scripts are new files
- Playwright chromium via existing `playwright` devDependency
