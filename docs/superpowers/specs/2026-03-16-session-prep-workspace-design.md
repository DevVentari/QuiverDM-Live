# Session Prep Workspace — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Replaces:** `PrepWizard` (linear 8-step wizard at `src/components/session/prep/prep-wizard.tsx`)

---

## Problem

The current session prep is a linear 8-step wizard. DMs can't jump between sections freely, can't import their existing notes (Obsidian, Google Docs, handwritten sketches), and get no AI assistance until they manually fill each step. Prep still takes too long.

---

## Solution

Replace the wizard with a **prep workspace**: a free-form, document-first prep surface. DMs import raw notes at the top, DM Brain extracts and pre-populates prep sections, and all 8 sections are visible as collapsible cards — no forced step order.

---

## Route

`/campaigns/[slug]/sessions/prep?sessionId=<id>` — unchanged. Page component swaps `PrepWizard` → `PrepWorkspace`.

---

## Layout

### Desktop
- **Sticky header** — editable session title, auto-save status, Mark Complete button, back to sessions link
- **Left sidebar (fixed, 220px)** — section nav: 8 items with completion dots and scroll-spy active state
- **Main column** — Import Zone (top) + 8 section cards

### Mobile
- No sidebar
- Sticky bottom bar: section count completed (e.g. "3 / 8 done") + Mark Complete button
- Sections stack vertically

---

## Import Zone

Located at the top of the main column. Collapsible after first import (shows "Notes imported · Re-import" label when collapsed).

**Accepts:**
- PDF file (drag-drop or file picker)
- Image file — JPG/PNG of handwritten notes or sketches
- Plain text paste (textarea)

**Flow:**
1. DM drops/pastes content
2. File uploaded to R2 via existing `/api/uploads` presigned URL flow
3. `sessions.extractPrepFromNotes` mutation called with `{ sessionId, url?, text? }`
4. Server calls `extractPrepNotes(input)` → returns `Partial<SessionPrepData>`
5. Returned suggestions merged into local prep state — each section card shows "Brain suggested N items" badge
6. Import metadata saved into `prepData.importedNotes[]`

**States:** idle → uploading → extracting → done (with suggested counts per section) → error

---

## Section Cards

All 8 sections rendered as collapsible cards. Same sections as the wizard:

| # | Section | Key content |
|---|---------|-------------|
| 1 | Review Characters | Per-character goals + spotlight notes |
| 2 | Strong Start | Opening hook text |
| 3 | Potential Scenes | Scene beat list |
| 4 | Secrets & Clues | Discoverable truths list |
| 5 | Featured NPCs | NPC picks + what they want |
| 6 | Monsters | Threats/hazards list |
| 7 | Rewards | Treasure + story rewards |
| 8 | Loose Threads | Unresolved hooks |

**Card anatomy:**
- Header (always visible): section name, completion dot, suggested count badge (if Brain extracted content), expand/collapse chevron
- Body (expanded): existing step component content (reused unchanged)
- Footer (expanded): "Accept all suggestions" button if Brain content pending

**Default state:** All collapsed. Sections with Brain suggestions auto-expand on load.

---

## AI Extraction

**New file:** `src/lib/ai/extract-prep-notes.ts`

Input: `{ text?: string; fileUrl?: string; campaignContext: { npcs, characters, recentSessions } }`

Output: `Partial<SessionPrepData>` — only populates fields where the model finds relevant content. Missing fields left undefined (not overwritten).

Uses the existing multi-provider AI chain (`src/lib/ai/`) — same Ollama/Gemini/OpenAI fallback stack as homebrew extraction.

Prompt instructs the model to extract:
- Strong start ideas → `strongStart`
- Scene hooks → `scenes[]`
- NPC mentions → `npcs[]` (matched against campaign NPCs where possible)
- Monster/threat mentions → `monsters[]`
- Secrets or clues → `secretsAndClues[]`
- Reward mentions → `rewards[]`
- Unresolved threads → `looseThreads[]`

---

## Data Model

No Prisma schema changes. `importedNotes` stored in `prepData` JSON field on `GameSession`:

```ts
// Addition to SessionPrepDataSchema (src/lib/prep-types.ts)
importedNotes: z.array(z.object({
  url: z.string().optional(),
  extractedAt: z.string(),
  sectionCounts: z.record(z.string(), z.number()),
})).optional().default([]),
```

---

## tRPC

**New mutation:** `sessions.extractPrepFromNotes`
- Auth: `campaignDMProcedure`
- Input: `{ sessionId: string; url?: string; text?: string }`
- Returns: `Partial<SessionPrepData>`
- Side effect: none — caller merges result into local state and auto-saves

---

## New Components

| File | Purpose |
|------|---------|
| `src/components/session/prep/prep-workspace.tsx` | Root replacement for `prep-wizard.tsx`. Same props. |
| `src/components/session/prep/prep-import-zone.tsx` | Upload/paste widget with extraction state machine |
| `src/components/session/prep/prep-section-card.tsx` | Collapsible card wrapping existing step components |
| `src/components/session/prep/prep-section-nav.tsx` | Sticky sidebar nav (scroll-spy + click-to-jump) |

## Modified Files

| File | Change |
|------|--------|
| `src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx` | Swap `PrepWizard` → `PrepWorkspace` |
| `src/server/routers/sessions.ts` | Add `extractPrepFromNotes` mutation |
| `src/lib/prep-types.ts` | Add `importedNotes` field to schema |

## Unchanged

- All 8 existing step components (`step-*.tsx`) — reused inside section cards
- Auto-save hook (`useAutoSave`)
- `prepData` structure (additive only)
- `completePrep`, `updatePrep`, `updateSession` mutations

---

## Play Routes

Commit `/play/[slug]/` pages as-is alongside this work. They are complete and require no further changes.

---

## Out of Scope

- Voice input for prep notes (future)
- Real-time Brain inference during session (cockpit feature)
- Drag-and-drop reordering of section cards
