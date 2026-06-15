# Applied — QuiverDM Design System rollout

This documents where the token system in this handoff is **already applied** in the QuiverDM prototypes, so a developer can see the system in real screens (not just the spec).

## Type system in use
- **Kalam** — story/display: page titles, character & place names, narration, cinematic beats.
- **Hanken Grotesk** — body/UI: descriptions, lists, statblocks, settings, tables, transcripts.
- **mono** (`ui-monospace`) — stat numbers, tracking-letter uppercase labels, codes, timers.

## Signature pattern in use — Icon Overlay
On badges, buttons & cards the relevant **dnd glyph** rides behind the label as a low-opacity (.10–.18) watermark, tinted to the component's semantic color and bled off an edge. Container `position:relative;overflow:hidden`; content `z-index:1`. See `tokens.css` `.qd-overlay` and the style guide section 10.

## Iconography in use
Emoji were replaced with the **dnd icon set** (single-path SVG glyphs, tinted via CSS `mask`). Representative subset in `assets/icons/`; full library is the attached `dnd/` folder (~309 glyphs across 21 categories).

## Screens upgraded to the system
**Core loop (Tier 1)** — Returning DM Home · Campaign Overview · Combat Map · DM Combat Tracker (Live)
**Dense data (Tier 2)** — Compendium (statblocks) · Character Sheet (DM) · NPC Management
**Story & player (Tier 3)** — Theatre Scene · Tavern + Shop Scene · Player Combat HUD
**Admin & utility** — Account & Billing · Table & Player Management · Campaign Settings · Auth + Onboarding · System Patterns

Each uses Kalam titles/names, Hanken body, tinted dnd glyphs, and the icon-overlay treatment on cards/badges/buttons where it adds depth.

## Still on the original (single-Kalam) styling
A handful of secondary scenes/wireframes (e.g. RP Scene, Location/World Map, Session Flow, Recordings, Homebrew Creator, Player Lobby/Journal) are mid-migration — same tokens apply; they just need the per-screen Kalam→Hanken split and emoji→glyph swap. Build them from the same tokens.

## How to consume
1. Import `tokens.css` at `:root` (or spread `tailwind.config.js` / read `tokens.json`).
2. Load fonts: Kalam + Hanken Grotesk (self-host for production).
3. Use the dnd glyphs via CSS `mask` + `background` tint (never `<img>`).
4. Apply the icon-overlay pattern on cards/badges/buttons per the style guide.
