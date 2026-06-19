> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Session Flow & Management — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (all panels)
**State:** One HTML file. Six wireframe panels arranged in a 2×3 grid, each showing a different screen in the session lifecycle. Low-fidelity style — structural layout, typography hierarchy, component placement — not full visual polish. Annotations allowed.
**Campaign context:** The Shattered Compact, Session 9 — "The Chronicle's Reckoning"

---

### THE FORMAT

Produce **one self-contained HTML file** with six labelled wireframe panels displayed in a 2×3 grid. Each panel should:
- Be roughly 680px × 460px (scaled to fit)
- Use the dark design system (CSS variables from the brief)
- Show structural layout with real content (not lorem ipsum)
- Include a panel label top-left in Cinzel (e.g., "01 — Session List")
- Include 1–2 brief annotation callouts per panel (small numbered circles with a legend line beneath each panel explaining what to notice)

Think of these as architectural sketches — enough to understand layout, hierarchy, and information flow. Not pixel-perfect, but definitely not grey boxes.

---

### THE SIX PANELS

---

**Panel 01 — Session List (Campaign Hub)**

The entry point for a campaign's session history. This is where the DM lands after opening The Shattered Compact.

Layout: A header with campaign name and a "New Session" button. Below: a vertical list of sessions, most recent first.

Show four sessions:
- **Session 9 — "The Chronicle's Reckoning"** — status: LIVE (pulsing red dot) — today — shows elapsed time counter
- **Session 8 — "The Wandering Markets"** — status: REVIEW NEEDED (amber) — 3 days ago — "4 entities pending extraction"
- **Session 7 — "Tide and Fire"** — status: COMPLETE — 1 week ago — "9 entities · 2h 14m"
- **Session 6 — "Bonfire Keep"** — status: COMPLETE — 2 weeks ago — "12 entities · 3h 01m"

Each row shows: session number, title, date, duration, entity count, status badge. The LIVE session row pulses subtly. "Session 8" has an amber warning indicator — unreviewed extraction.

Heartflame perched in the top-right, a faint line surfacing in its glow: *"One chronicle unread. Four names waiting."*

Annotation callouts:
1. LIVE indicator draws the eye — always top of the list, never sorted away
2. The "review needed" state is a soft prompt, not an alarm — DM decides when to review

---

**Panel 02 — Pre-Session Prep**

The screen the DM opens the night before (or the hour before) a session. Planning mode — not live.

This is a DM workspace, not a checklist. The feel should be "opening a notebook", not "filling out a form".

Layout: Two columns. Left (~55%): editable session brief — title, planned date, freeform prep notes area with subtle placeholder text in Heartflame's voice: *"What does the world know that the players don't yet?"* Below notes: a "Planned Encounters" section (can add encounter cards). Right (~45%): "World Pulse" — what's changed since last session. Show three auto-generated callouts from the world state:
- "Captain Draven has not appeared since Session 7. His absence is 9 days."
- "Oriyen's obsidian mirror cracked. No entry recorded."
- "Concordia Stellaris: Reality Tear status unknown since last visit."

Below World Pulse: a "Characters" strip showing Norm / Oriyen / Skreek with HP at session-end last time and any carry-over conditions.

Bottom bar: "Start Session →" button (amber, prominent) and "Save Prep Notes" ghost button.

Annotation callouts:
1. The world pulse surfaces things the DM might have forgotten — it remembers so they don't have to
2. "Start Session" is the only CTA that matters on this page — everything else is ambient

---

**Panel 03 — Start Session (Go Live Flow)**

The moment of beginning. DM clicks "Start Session →" and gets a focused pre-flight screen before the transcript starts rolling.

Layout: Centred card overlay on a dark background. Not a multi-step wizard — everything on one screen, scannable in 10 seconds.

Card contents:
- Session title (editable): "The Chronicle's Reckoning"
- Session number: auto-filled — Session 9
- **Audio source selector:** "Built-in Mic" selected (dropdown). Small waveform visualiser showing audio is live — green bars pulsing.
- **Transcription toggle:** ON (Whisper v3) — small label: "Live entity extraction enabled"
- **Party present:** Three player chips — Norm ✓ · Oriyen ✓ · Skreek ✓. Tap to toggle absent players.
- **Carry-over conditions:** One warning: "Skreek — Poisoned condition from Session 8 (not resolved). Include?" with Yes / Clear buttons.

At the bottom of the card: a large amber "Begin Session" button. Below it in mono text: "Recording will start immediately."

Heartflame absent from this screen — it knows this moment belongs to the DM.

Annotation callouts:
1. One screen, no steps — the DM should never click "next" three times before a session starts
2. Carry-over conditions prevent state drift between sessions — important continuity feature

---

**Panel 04 — Active Session (Transcript Focus)**

A zoomed-in view of the live transcript panel during the session. This is a detail panel — not the full layout from the active-session wireframe, but a focused look at the transcript interaction layer.

Show the transcript mid-session: 6–8 lines of conversation between Norm, Oriyen, Skreek, and the DM. Real content from The Chronicle's Reckoning — the moment Faeren appears.

Focus the layout on three interaction moments happening simultaneously:
- A new entity highlight appearing mid-sentence: "Faeren the Story-Bearer" lights up amber as the name is spoken, with a tiny shimmer animation indicator
- A **Quick Link prompt** floating above the highlighted name — a small popover: "Faeren the Story-Bearer — Link to world? [Add Note] [Link] [Dismiss]"
- A **Heartflame moment** at the bottom right of the pane — a small line surfacing in the Heartflame's glow: *"Faeren has worn eleven faces. Nine of them are gone."* with a subtle dismiss ×

The surrounding transcript lines are slightly dimmed — the entity interaction is the focal point right now.

Annotation callouts:
1. Entity linking is non-blocking — the DM can dismiss and keep listening, or link in-moment
2. Heartflame speaks exactly once per notable entity arrival — then goes quiet

---

**Panel 05 — Post-Session Extraction Review**

After "End Session" is clicked, the DM lands here. Heartflame has been working the whole time — this is the delivery.

Layout: Two columns. Left (~45%): the entity extraction queue — a vertical list of what Heartflame surfaced during the session. Right (~55%): the world entry preview for whichever entity is selected.

Show 5 entities in the queue:
- **Faeren the Story-Bearer** — NPC — ✓ Already in world (linked, confirmed) — green badge
- **The Knowledge Serpent** — NPC — ⚠️ New — "Not yet in world. Add?" — amber badge
- **Concordia Stellaris: Reality Tear** — Location detail — ✓ Linked to existing location — green
- **Duskfall Blade** — Item — ⚠️ New mention — "First appearance this session" — amber badge
- **Scribe Valdris** — NPC — ❓ Ambiguous — "Mentioned by Faeren — historical figure or active?" — grey badge with question mark

The Knowledge Serpent is selected — the right panel shows a partial auto-generated world entry: name, type (Aberration), session first seen, transcript excerpt that mentioned it, and a freeform description field (pre-filled by AI, editable by DM). Below: [Add to World] [Edit First] [Ignore] buttons.

Top of the extraction panel: a Heartflame summary line in a card: *"A busy night. Five names. Two that matter."*

Annotation callouts:
1. The DM reviews, not approves — the AI drafts, the DM decides. No auto-adds.
2. Ambiguous entities are flagged, not discarded — the DM resolves them, not the system

---

**Panel 06 — Completed Session Detail**

A session from the archive — what Session 8 looks like after it's been reviewed and closed.

Layout: Full-width header with session metadata (title, date, duration, entity count). Below: three columns.

Left column (30%): session metadata card — date, duration (2h 47m), players present (Norm · Oriyen · Skreek), entities added (9), notes count (3). Below: a "World Changes" summary — 3 bullet lines of what changed in the world state as a result of this session. E.g., "Skreek's plague arm: first activation documented." / "Knowledge Serpent: active threat status assigned." / "Concordia Stellaris: Reality Tear added to location."

Centre column (45%): transcript excerpt — the 5–6 most entity-rich moments of the session, highlighted. Not the full transcript — just the peaks. A "View Full Transcript →" link at the bottom.

Right column (25%): entities surfaced — the same 9 entity chips from extraction review, now all green (accepted). Clicking one opens the world entry for it in a drawer.

At the very top right: a "Recording" chip — shows session length. Clicking would open the recording player.

Heartflame perch at bottom-right of the panel: idle, burning low. The session is done. The world remembers.

Annotation callouts:
1. Completed sessions are read-only world history — the DM can reference but not re-edit
2. "World Changes" is the most valuable affordance here — it answers "what did this session actually do to my campaign?"

---

*QuiverDM v3.0-alpha1 — Session Flow & Management Design Request*
