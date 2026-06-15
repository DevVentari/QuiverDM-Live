# QuiverDM v3 — Design Source & Reconciliation Index

This folder is the reference spec for the v3 redesign. It is **design source**, not
shipping code. Implementation lives behind the `QDM_V3` flag under `src/app/v3/`.

## Contents

| Path | What it is |
|---|---|
| `v3-master-design-prompt.md` | The canonical brief. Paste at the top of any design request. Defines the feel, the page set, and the **Heartflame** companion (the AI familiar, reconceived as a living hearth-flame — formerly prototyped as "Scrollkin"). |
| `prompts/*.md` | Per-screen design-request briefs (10). |
| `designs/*.dc.html` | 49 HiFi + wireframe mockups (self-contained DesignCraft prototypes). Throwaway visual references; rebuilt as React in Track C. |
| `designs/assets/dnd/*.svg` | 92 monochrome D&D silhouette icons (a subset of the existing `public/icons/dnd/` library, which already ships 286 icons). Consumed via the existing `MaskedDndIcon` (`src/components/icons/masked-dnd-icon.tsx`, mask + `currentColor`); browse them at `/dev/icons`. |
| `nudge-system-diagram.excalidraw` | The Heartflame nudge pipeline: inputs → predicate engine → category → rotating line pool → delivery (+ optional AI re-skin). Drives Track B. |

## Companion naming

The companion is **Heartflame** (a flame-spirit meta-familiar) with intentional resonance to
the in-world Heartflame lore (`prisma/seeds/hameria-ire.ts` → `world-lore_anchors-and-heartflame.json`).
The nudge surface is labelled **"In the Margins."** Code uses `heartflame` (e.g. `src/lib/heartflame/`,
`HeartflamePerch`). Campaign/session names in the mockups (e.g. "The Shattered Compact") are mock
placeholders, not canon.

## Screen → route map (Track C target)

| Design(s) | Target v3 route | Status |
|---|---|---|
| Home Dashboard / Returning DM Home | `/v3` | foundation placeholder |
| Campaign Nav / Overview | `/v3/campaigns/[slug]` | pending |
| Session Flow / Active Session | `/v3/campaigns/[slug]/sessions` | pending |
| DM Combat Tracker / Combat Map | `/v3/campaigns/[slug]/combat` | pending (needs Track B board-state) |
| NPC Management / Character Sheet | `/v3/campaigns/[slug]/npcs`, `/v3/characters/[id]` | pending |
| Locations / World Map | `/v3/campaigns/[slug]/locations` | pending |
| Compendium | `/v3/campaigns/[slug]/compendium` | pending |
| Homebrew Creator | `/v3/campaigns/[slug]/homebrew` | pending |
| Theatre of the Mind / Scenes | `/v3/campaigns/[slug]/scenes` | pending (net-new) |
| Player Portal screens | `/v3/play/...` | pending (net-new) |
| Iconography / System Patterns | existing `/dev/icons` gallery (reused) | done |

See `docs/superpowers/specs/2026-06-15-wireframe-reconciliation-map.md` for the detailed per-screen map.
