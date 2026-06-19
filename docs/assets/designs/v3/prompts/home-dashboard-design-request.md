> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Global Home / All Campaigns Dashboard — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (panels 01–05) · Mobile 390px (panel 06)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Design note:** This is the emotional entry point to QuiverDM — the first thing you see every time you open the app. It must feel like the world remembering you walked away. Not a dashboard. Not a grid of cards. A living archive noticing your return.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real content throughout. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Home: Returning DM (hero state)**

Blake opened QuiverDM for the first time in 4 days. This is what he sees.

This panel explores the **hero layout** — how to greet a DM who has been away. The emotional beat is: the world kept moving while you were gone.

Layout: Full-width, no sidebar. Three horizontal zones stacked.

**Zone 1 — Heartflame Welcome (top, ~120px):**
Not a notification. Not a banner. A moment. Heartflame burning at the left of a soft glow, a line surfacing in its light:
*"Four days since the chronicle moved. The Knowledge Serpent has not been idle."*
Beneath that, in smaller mono text: "Session 9 complete · 3 open threads · 1 unreviewed extraction"
No dismiss button — it fades on interaction.

**Zone 2 — Active Campaign (centre, ~240px):**
The campaign Blake is most likely returning to: **The Shattered Compact**. Displayed as a large hero card — atmospheric, almost full-width. Dark gradient with faint amber glow upper-left (Bonfire Keep energy). Contents:
- Campaign title: "The Shattered Compact" — Cinzel display, large
- Last played: "4 days ago · Session 9 — The Chronicle's Reckoning"
- World pulse line: *"The Reality Tear is open. Draven is alive and knows."*
- Party chips: Norm · Oriyen · Skreek
- Two CTAs: "Continue →" (amber, primary) · "Review Session 9" (ghost)
- Status badges: 1 THREAT (Knowledge Serpent) · 1 UNSTABLE (Reality Tear) · 3 open threads

**Zone 3 — Other Campaigns (bottom, ~100px):**
A compact horizontal strip showing 2 other campaigns (smaller cards, less emphasis):
- "The Iron Marches" — last played 3 weeks ago — 4 sessions — Status: Paused
- **+ New Campaign** — ghost card, dashed border, amber + icon

Annotation callouts:
1. One campaign dominates — the most recently played gets the hero. Others are accessible but not competing.
2. The Heartflame greeting is ambient context, not a to-do list — it surfaces what matters, then steps aside.

---

**Panel 02 — Home: Multi-Campaign View**

A DM running two or three active campaigns simultaneously. The dashboard needs to be fair to all of them without losing the sense that one world is more alive than another.

Layout: Shifted away from hero-single-card toward a richer grid. Two-column layout with an asymmetric split.

**Left column (~60%):**

Two campaign cards stacked — each larger than Panel 01's strip but smaller than the hero card:

**The Shattered Compact:**
- Session 9 · 4 days ago · LIVE THREAT indicators (2)
- Last transcript excerpt: *"The Knowledge Serpent is reading Oriyen's memories."*
- Party: Norm · Oriyen · Skreek · 3 entities pending review
- CTA: "Continue →"

**The Iron Marches:**
- Session 14 · 3 weeks ago · Status: Planning next session
- Party: 4 players (chips)
- World pulse: "Campaign arc 2 of 3 complete."
- CTA: "Plan Session 15 →"

**Right column (~40%):**

A "What's Across All Worlds" digest — Heartflame reading the full library:
- Total sessions: 23
- Total NPCs created: 47
- Total entities extracted: 312
- Sessions this month: 4

Below the digest: a **Recent Activity** feed — 5 items, cross-campaign, newest first:
- "Session 9 complete — The Shattered Compact — 4 days ago"
- "Extraction review pending — 4 entities — The Shattered Compact"
- "Session 14 complete — The Iron Marches — 3 weeks ago"
- "NPC created: Temmel of the Endless Vigil — 6 weeks ago"
- "Campaign started: The Iron Marches — 2 months ago"

Annotation callouts:
1. The cross-campaign digest gives DMs who run multiple tables a bird's-eye view without switching contexts
2. Recent activity is chronological, not campaign-siloed — the DM sees their whole practice at once

---

**Panel 03 — New Campaign Wizard (Step 1 of 3)**

The onboarding moment for a first campaign — or a new one. This is where the world begins.

Heartflame's most important job in the whole app: making this feel like opening a blank tome, not filling out a registration form.

Layout: Full-screen centred card, ~640px wide. Dark atmospheric background. Three steps shown as a dot-progress indicator (Step 1 active).

**Step 1 — Name the World:**

Header in Cinzel, large: *"Name the World"*
Subtitle in Bricolage Grotesque, muted: *"The rest follows."*

One large input field — no label, just placeholder text styled in Heartflame's voice:
*"What do the maps call this place?"*

DM has typed: "The Shattered Compact"

Below the input: a secondary field fades in gently:
*"And what threatens it?"*
Placeholder: *"One sentence. The shape of the darkness."*
DM has started typing: "An imprisoned goddess of entropy, corrupting from beneath the capital—"

Below the second field: a "Setting" tag row — quick picks to give the AI context:
Fantasy · Sci-fi · Horror · Historical · Custom
"Fantasy" is selected (amber tint).

No "Next" button yet — it appears once both fields have content. Shows as amber "Begin the Chronicle →"

Small Heartflame perch bottom-right of the card: burning low. Working. Not yet speaking.

Annotation callouts:
1. Two questions instead of a form — the DM's answer to "what threatens it" seeds the entire world's AI context
2. No submit until both fields are filled — the wizard won't let you name an empty world

---

**Panel 04 — New Campaign Wizard (Step 2 of 3 — Party)**

Step 2: Who is in the party?

Same card layout, Step 2 dot active.

Header: *"Name the Souls"*
Subtitle: *"The party who will make the chronicle."*

Three player character slots shown as cards in a row, each ~180px wide:

**Slot 1 (filled):**
- Name: Norm Alfella
- Class/Race: Warlock · Human
- Player: Blake
- Import options: [D&D Beyond] [Manual]
- Status: ✓ Linked to D&D Beyond

**Slot 2 (filled):**
- Name: Oriyen Vale
- Class/Race: Monk · Shadowfell
- Player: (unnamed — empty player field)
- Status: ✓ Added manually

**Slot 3 (filled):**
- Name: Skreek Swicschnout
- Class/Race: Rogue · Skaven
- Player: (unnamed)
- Status: ✓ Added manually

**+ Add Another** ghost slot card.

Below the party row: "Invite players to their characters?" — toggle ON. A brief explanation: "Players can view their character sheet and action economy during sessions. They won't see the DM view."

Bottom of card: "← Back" ghost · "Continue →" amber

Annotation callouts:
1. D&D Beyond import is the fastest path — one OAuth, character sheet populates automatically
2. Players are optional — many DMs use QuiverDM solo without player-facing views

---

**Panel 05 — Global Search (cross-campaign)**

The DM searches across everything — not just the current campaign. Looking for an NPC name, a session note, a location they vaguely remember.

Layout: Full-screen overlay. Search bar front and centre, no other chrome.

Search bar: large, centred, ~700px wide. Placeholder: *"Search the archive..."* — in Heartflame's voice. DM has typed: "serpent"

**Results below, grouped by type:**

**NPCs (2):**
- The Knowledge Serpent — The Shattered Compact — Threat · Session 9 — → View
- Serpent Cult Archivist — The Iron Marches — Historical · Session 11 — → View

**Sessions (1):**
- Session 9 "The Chronicle's Reckoning" — The Shattered Compact — Transcript mention: "...the Knowledge Serpent is reading Oriyen's memories..." — → View

**Locations (0):** — greyed group header, no results

**Items (0):** — greyed

**Notes (1):**
- DM Note — The Shattered Compact — "The Serpent entered through Oriyen's chronicle. The door is still open." — Session 9 — → View

Below results, a Heartflame faint line: *"Two serpents in two worlds. Only one is hunting you."*

Keyboard shortcut hint at bottom: "↑↓ navigate · Enter open · Esc dismiss" — in mono text, muted.

Annotation callouts:
1. Results are cross-campaign by default — a DM's memory doesn't silo by campaign and neither should search
2. Heartflame's one-liner is the only non-result content — it notices the two serpents so the DM doesn't have to

---

**Panel 06 — Home: Mobile (390px)**

The DM opening QuiverDM on their phone. Maybe mid-session, maybe between sessions, maybe at 11pm realising they forgot to prep.

Layout: Vertical stack. No sidebar. No chrome. Just world.

**Top:** QuiverDM logo mark (small amber icon) · "QuiverDM" in small Cinzel

**Heartflame greeting strip (full width, amber-tinted):**
*"Session 9 is done. Three threads open. The Serpent is named."*
Tappable — opens the world pulse.

**Active campaign card (full width, large):**
- "The Shattered Compact" — Cinzel
- Session 9 complete · 4 days ago
- Status: 🔴 Knowledge Serpent — Active Threat
- CTA: "Continue →" — amber, full-width button, 52px tall

**Other campaigns (compact list, 2 items):**
- The Iron Marches — 3 weeks ago — Plan Session 15 →
- + New Campaign

**Quick actions row (3 equal buttons, 44px height):**
- 🔍 Search
- ✏️ Quick Note
- ⚔️ Start Combat

**Heartflame** at the very bottom — tiny silhouette, barely there. No text. Watching.

Annotation callouts:
1. One campaign, one CTA — the phone home screen has one job: get the DM back into their world
2. Quick actions row covers the three most common mid-session phone reaches: search, note, combat

---

*QuiverDM v3.0-alpha1 — Home / All Campaigns Dashboard Design Request*
