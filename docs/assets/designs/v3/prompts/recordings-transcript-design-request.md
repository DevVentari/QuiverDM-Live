> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Recordings & Transcript Review — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (all panels)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Campaign context:** The Shattered Compact Session 9 — "The Chronicle's Reckoning". 1h 47m recording. The DM is reviewing the session the next day.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real content throughout. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Recording List**

All session recordings for the campaign. The audio archive.

Layout: Left sidebar (~220px) — filters and search. Main area: recording list.

Left sidebar:
- Search bar
- Filter: All Sessions · With Transcript · Processing · Failed
- Sort: Newest · Oldest · Longest · Most entities

Main list (each row a recording card, ~90px tall):

- **Session 9 — "The Chronicle's Reckoning"** · 1h 47m · Today · ✓ Transcript complete · 11 entities · Status: Review pending (amber)
- **Session 8 — "The Wandering Markets"** · 2h 14m · 3 days ago · ✓ Transcript complete · 9 entities · Status: Reviewed ✓
- **Session 7 — "Tide and Fire"** · 3h 01m · 1 week ago · ✓ Transcript complete · 14 entities · Status: Reviewed ✓
- **Session 6 — "Bonfire Keep"** · 2h 33m · 2 weeks ago · ✓ Transcript complete · 12 entities · Status: Reviewed ✓
- **Session 5 — "First Blood"** · 1h 58m · 3 weeks ago · ⟳ Reprocessing transcript · Status: Processing (pulsing dot)

Each row: session number, title, duration in JetBrains Mono, date, transcript status, entity count, review status. Clicking a row opens Panel 02.

Summary bar at top: "9 sessions · 19h 47m total · 89 entities extracted"

Annotation callouts:
1. "Review pending" is amber, not red — it's an invitation, not an alarm. The DM chooses when to review.
2. Reprocessing is shown clearly — Session 5 is being re-transcribed. The DM knows it's in progress.

---

**Panel 02 — Recording Detail: Session 9 (Overview)**

The main recording page. The DM lands here after clicking Session 9.

Layout: Three sections stacked. Top: recording player. Middle: session summary. Bottom: tabs for transcript, entities, notes.

**Recording player (top strip, ~80px):**
Waveform visualiser — dark background, amber waveform peaks. Current position: 0:00. Total: 1:47:23.
Controls: ◀◀ 15s · ▶ Play · ▶▶ 15s · Speed: 1× ▾ · Volume slider.
Below the waveform: a coloured entity density strip — a timeline heatmap showing where in the recording entities were mentioned most. Peaks at ~30min and ~1h20min (the Faeren scene and the Knowledge Serpent reveal). Amber peaks, teal peaks for locations.

**Session summary card (middle, ~140px):**
- Session 9 · "The Chronicle's Reckoning" · 1h 47m · Concordia Stellaris
- Party: Norm Alfella · Oriyen Vale · Skreek Swicschnout
- Entities: 11 surfaced (5 NPCs · 4 Locations · 2 Items)
- Key moments: 3 flagged (amber stars) — DM can add/edit

Three flagged moments shown as chips:
⭐ 0:32:24 — "Faeren the Story-Bearer appears (new entity)" · Jump to →
⭐ 1:03:17 — "Knowledge Serpent confirmed — Oriyen's mirror cracks" · Jump to →
⭐ 1:38:51 — "Skreek splits from party — Pip signs the warning" · Jump to →

**Tab bar (bottom section):** Transcript · Entities · Notes. Active: Transcript.

Annotation callouts:
1. Entity density heatmap turns a 1h47m recording into a navigable map — the DM jumps to what matters
2. Flagged moments are the DM's bookmarks — set during the session or added during review

---

**Panel 03 — Recording Detail: Transcript Tab (Timestamped)**

The full session transcript with timestamps, entity highlights, and playback sync.

Layout: Two columns. Left (~60%): transcript scroll. Right (~40%): entity panel for the selected line.

**Left column — Transcript:**

Show 8–10 lines of the Session 9 transcript. Same real content from the active session wireframe — but now as a post-session review. The player is paused at 1:03:17 (the Knowledge Serpent reveal). That line is highlighted with an amber left border.

Lines above it (earlier in session, slightly dimmed — past content):
- 1:30:04 DM · "The festival grounds are alive tonight..."
- 1:30:31 Skreek · "I taste it. Corruption. Different from mine..."
- 1:31:12 Norm · "Pip said the network had eyes on three exits..."
- 1:32:08 Oriyen · "I take it out. What do I see?"
- 1:32:24 DM · "The obsidian surface doesn't show your face..."

**Current line (amber highlight):**
- 1:32:51 Oriyen · "It's **the Knowledge Serpent**. The watcher from the Archive. It's already here."

Lines below (future content, full brightness — the DM is reviewing):
- 1:33:07 Norm · "What does it want with us?"
- 1:33:22 DM · "**Faeren the Story-Bearer** steps from behind the monument pillar..."

Entity highlights work the same as in the live session — NPC amber, Location teal, Item arcane purple — but now they're retrospective, linked to world entries.

Playback sync: clicking any line jumps the player to that timestamp. The waveform scrubs to match.

**Right column — Entity panel:**
Shows the entity for the currently highlighted line: The Knowledge Serpent.
- Badge: NPC · THREAT
- Added to world: Session 9 (this session)
- Transcript mentions this session: ×4
- Quick note: "Oriyen named it. Origin: Archive of Withered Echoes."
- "Open full entry →" link

Annotation callouts:
1. Transcript is synced to playback — click a line to jump the audio. The DM can re-listen to any moment.
2. Entity panel updates as the DM scrolls — the right side always shows context for whatever's highlighted

---

**Panel 04 — Recording Detail: Entities Tab**

All entities surfaced during the session, with their transcript context.

Layout: Full-width. Tab active: Entities.

A filter bar at top: All (11) · NPCs (5) · Locations (4) · Items (2) · New this session (3) · Existing (8)

Active filter: New this session (3)

Three entity cards shown, full-width, ~120px each:

**Card 1 — Faeren the Story-Bearer (NEW):**
- Badge: NPC · NEW THIS SESSION
- First mention: 1:33:22 — *"Faeren the Story-Bearer steps from behind the monument pillar..."*
- Total mentions: ×3
- Added to world: ✓ Session 9
- Transcript excerpt (the defining line): *"'Not you, little warlock. The chronicler. It has been watching since the first scroll.'"*
- Heartflame note: *"She chose Scribe Valdris's face. She has been watching Oriyen longer than the party knows."*
- Actions: Open World Entry · Find all mentions · Play audio at first mention ▶

**Card 2 — The Knowledge Serpent (NEW):**
- Badge: NPC · NEW · THREAT
- First mention: 1:32:51 — Oriyen names it
- Total mentions: ×4
- Transcript excerpt: *"It's the Knowledge Serpent. The watcher from the Archive. It's already here."*
- Added to world: ✓ Session 9 · Status: Active Threat
- Actions: Open World Entry · Find all mentions · Play audio ▶

**Card 3 — Duskfall Blade (NEW MENTION):**
- Badge: Item · FIRST SESSION MENTION
- Previously in world: ✓ (created in prep, never mentioned in session until now)
- First mention: 1:36:22 — Oriyen identifies Draven's blade
- Total mentions: ×2
- Transcript excerpt: *"Draven's soldiers. The Duskfall Blade — he's already moved them into position."*
- Actions: Open World Entry · Find all mentions · Play audio ▶

Annotation callouts:
1. "New this session" filter is the most useful — DMs review new things, not things they already know
2. "First session mention" catches items built in prep that finally appeared — the world and the story converged

---

**Panel 05 — Recording: Playback with Chapter Markers**

The DM is using the recording to re-listen to a specific moment — the Faeren reveal. Focused playback mode.

Layout: Expanded player takes centre stage. The transcript collapses to a narrow strip on the right.

**Playback zone (centre, ~65% width):**

Large waveform visualiser — full height. The amber waveform is detailed and beautiful.
Current position: 1:33:22 — The Faeren reveal moment. The waveform is paused here, cursor sitting on a peak.

**Chapter markers** visible on the waveform timeline (coloured tabs below the waveform):
- 0:00 — Chapter: "Festival Grounds" — DM narration
- 0:31:00 — Chapter: "Skreek's Network" — entity cluster
- ⭐ 1:32:00 — Chapter: "The Obsidian Mirror" — flagged (amber star tab)
- ⭐ 1:33:22 — Chapter: "Faeren Appears" — flagged, CURRENT (bright amber, expanded tab showing name)
- ⭐ 1:38:51 — Chapter: "Pip's Warning" — flagged
- 1:47:23 — End

Player controls below: ◀◀ 15s · ▶ Play · ▶▶ 15s · Speed: 1.5× · Loop this chapter (toggle)

**Right column — collapsed transcript strip:**
A narrow scrollable strip showing just the text of lines near the current position. The current line is highlighted. Clicking any line scrubs to it.

Below the strip: "Add chapter marker here" button — amber +.

"Export chapter" option in a ghost dropdown — "Export this chapter as audio clip · Export transcript segment"

Annotation callouts:
1. Chapter markers are the DM's session bookmarks — created live or added in review, they turn a recording into a navigable document
2. Loop chapter — for re-listening to a specific exchange without losing your place

---

**Panel 06 — Recording: Mobile Playback (390px)**

The DM is on their phone, replaying a moment from Session 9 before Session 10. They need to remember exactly what Faeren said.

Layout: Vertical stack. Full-width. Large touch targets.

**Top strip:**
Session 9 · "The Chronicle's Reckoning" · 1h 47m

**Player (full width, ~180px):**
Compact waveform — amber on dark. Scrubber at 1:33:22.
Controls row: ◀◀ · ▶ · ▶▶ · Speed (1.5× chip). All 44px min height.

**Chapter strip (horizontal scroll below player):**
Scrollable chips for each chapter. "Faeren Appears" chip is selected (amber tint).
< Festival Grounds | Skreek's Network | **Faeren Appears** | Pip's Warning >

**Transcript (below chapter strip, scrollable):**
The 4–5 lines around the current timestamp. Large enough to read at arm's length. The current line is highlighted (amber left border).

1:32:51 ORIYEN — "It's the Knowledge Serpent. The watcher from the Archive..."
**1:33:22 DM — "Faeren the Story-Bearer steps from behind the monument pillar..."** ← current
1:33:45 DM — "'Not you, little warlock. The chronicler...'"

**Entity chip strip (below transcript):**
Entities mentioned near current time — tappable chips: Faeren the Story-Bearer · Knowledge Serpent · Concordia Stellaris

**Bottom bar:** Add Note · Flag Moment · Share Timestamp

Annotation callouts:
1. Chapter chips replace full waveform navigation on mobile — the DM jumps by story beat, not by timestamp
2. Entity chips below the transcript link directly to world entries — pre-session research on the go

---

*QuiverDM v3.0-alpha1 — Recordings & Transcript Review Design Request*
