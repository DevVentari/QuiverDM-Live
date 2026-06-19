> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Campaign Overview — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (panels 01–05) · Mobile 390px (panel 06)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Campaign context:** The Shattered Compact, Session 9 just completed. Draven was stopped. The Reality Tear at Concordia Stellaris is still open. The Knowledge Serpent is now a named threat.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real campaign content throughout. 1–2 annotation callouts per panel. Dark design system throughout.

---

### THE SIX PANELS

---

**Panel 01 — Campaign Overview: Hero (Returning DM)**

The first screen after clicking into The Shattered Compact. The DM hasn't opened the app in 4 days. This is the moment the world wakes up.

This is the most emotionally important screen in the app. It must feel like cracking open a campaign book — the world catching its breath before the DM's eyes.

Layout: Full-width. No sidebar on this screen — the campaign takes the whole canvas.

Top: A campaign banner zone (~200px tall). Dark atmospheric gradient. Campaign title "The Shattered Compact" in large Cinzel display. Beneath it, a subtitle line auto-generated from world state: *"Session 9 complete. The Serpent is named. The tear remains open."* — in Bricolage Grotesque, muted amber.

Below the banner, three columns:

**Left column — World State** (what's true in the world right now):
Three status cards stacked:
- 🔴 **Active Threat:** The Knowledge Serpent — "Hunting Oriyen's memories. Uncontained."
- 🟠 **Unstable:** Reality Tear — Concordia Stellaris — "Still open. Alignment unknown."
- 🟢 **Stable:** Serenitas — "Still imprisoned beneath Aurelios. Binding ritual intact — for now."

**Centre column — Recent Activity** (what changed last session):
A short feed of 4–5 world events from Session 9, auto-generated from extraction:
- "Faeren the Story-Bearer surfaced — linked to Three Anchors"
- "The Knowledge Serpent added as Active Threat"
- "Draven's assassination attempt: failed — consequences pending"
- "Oriyen's obsidian mirror: cracked. Status changed."
- "Concordia Stellaris: Reality Tear — status escalated"

**Right column — Upcoming** (what's next):
- Next session: not yet scheduled — ghost card with "Plan Session 10 →"
- Party: Norm · Oriyen · Skreek (3 chips, green — all present last session)
- Open threads: 3 items flagged for follow-up (amber badge)

**Heartflame centre-bottom of banner**, a line surfacing in its glow: *"Four days since the chronicle moved. The Serpent has not been idle."*

Annotation callouts:
1. The banner subtitle is alive — it reads the world state and writes itself. Never static.
2. Three columns = three time horizons: now (threats), yesterday (session), tomorrow (prep)

---

**Panel 02 — Campaign Overview: World Pulse (expanded)**

A deeper view of the world state — what's alive, what's dormant, what's been forgotten.

This panel is the DM's "is my world breathing" view. Think of it as a living dashboard of the campaign's health.

Layout: Full-width. A "World Pulse" header in Cinzel with a subtle heartbeat animation indicator. Below: a 2-column layout.

Left column — **Entities by status:**
Four grouped sections, each collapsible:
- **Active Threats (2):** The Knowledge Serpent · Serenitas (imprisoned/escalating) — both with red status dots
- **In Play (5):** Temmel · Faeren · Ambric · Emperor Aurelias · Captain Helena Torres — green dots
- **Corrupted / Uncertain (2):** Captain Draven · High Sage Lyria Sunweaver — amber dots
- **Historical / Dormant (3):** Scribe Valdris · Withering Remnant A · Withering Remnant B (destroyed, greyed)

Right column — **Location pulse:**
Five locations shown as status cards:
- **Bonfire Keep** — Stable · Party hub · Last visited: Session 6
- **Concordia Stellaris** — ⚠️ Unstable · Reality Tear active · Last visited: Session 9
- **Aurelios the Golden** — ⚠️ Corruption escalating · 60% affected · Last visited: never
- **Archive of Withered Echoes** — 🔴 Hostile · Serpent origin · Last visited: backstory only
- **The Confluence** — Unknown · Tidal Covenant HQ · Never visited

Below the location cards: **Active Arcs** — a mini arc tracker showing 2 active campaign arcs:
- "The Entropy Crisis" — 65% progress bar (amber fill) — "Serenitas's binding weakening"
- "The Serpent's Hunt" — 15% progress bar — "Newly opened arc — Session 9"

Annotation callouts:
1. The world pulse is a campaign health check — the DM sees at a glance what's alive, what's rotting, what's been ignored
2. Arc progress bars are DM-set, not auto-calculated — the DM decides when an arc advances

---

**Panel 03 — Campaign Overview: Party Strip**

A focused view of the three PCs — their current state from the DM's perspective. Not their character sheets — the DM's view of them as story elements.

Layout: Three large cards in a row, one per character. Each card is ~300px wide, generous vertical height.

**Norm Alfella:**
- Class badge: Warlock · CHA 20
- HP: 51/51 (full — clean session)
- Conditions: None
- Active effects: Hex (carried from session? — expired, greyed)
- Pact Slots: 2/2 restored
- DM note (private field): *"Still doesn't know the warlock patron's identity. Hold that thread."*
- Last notable action: "Distracted Draven's vanguard with Goblin Camaraderie — bought Skreek 2 rounds"
- Relationship flags: 2 active (Skreek — "goblin soulmate" · Oriyen — "grounding presence")

**Oriyen Vale:**
- Class badge: Monk · WIS 16
- HP: 67/67 (full)
- Conditions: None
- Active effects: Fragment of Obsidian Mirror — CRACKED (status flag, amber)
- Ki Points: 6/6 restored
- DM note: *"The crack in the mirror is a ticking clock. Every vision from here is degraded."*
- Last notable action: "Identified the Knowledge Serpent from Archive memory — unlocked the threat name"
- Relationship flags: 1 active (Knowledge Serpent — "being hunted")

**Skreek Swicschnout:**
- Class badge: Rogue · DEX 15
- HP: 38/47 (took damage — not fully restored)
- Conditions: Poisoned (carry-over — amber badge, "resolve before Session 10")
- Active effects: Warpstone Shard — 1 charge spent
- DM note: *"Pip signed something at the end of the session that Skreek didn't share with the party. Follow up."*
- Last notable action: "Network intelligence via Plague-Touched — located Draven's soldiers before the party did"
- Relationship flags: 1 active (Pip — "network operative")

Bottom of the panel: a shared party note — "Session 9 aftermath: party split and reunited. No long rest. Skreek condition unresolved."

Annotation callouts:
1. The DM's private notes per character are the memory of a campaign — these fields are as important as HP
2. Carry-over conditions are surfaced loudly — they're the most common continuity error in long campaigns

---

**Panel 04 — Campaign Overview: Arc & Threat Board**

A visual board for the big story threads. The DM's 30,000-foot view of the campaign.

Layout: Kanban-style columns but for arcs, not tasks. Three columns:

**Column 1 — Active Arcs:**
- **The Entropy Crisis** — Main arc — "Serenitas's imprisonment weakening. Sunward Empire sitting on a cosmic bomb." — 65% progress (DM-set) — 9 sessions active — linked entities: Serenitas · Emperor Aurelias · Lyria Sunweaver · Bonfire Keep
- **The Serpent's Hunt** — New arc — "The Knowledge Serpent is pursuing Oriyen's archive memories. Origin unknown." — 15% progress — 1 session active — linked entities: Knowledge Serpent · Oriyen · Archive of Withered Echoes

**Column 2 — Simmering Threads (not yet arcs):**
- "What did Pip sign to Skreek?" — flagged from Session 9
- "Draven's assassination failed — what does that mean for Helena Torres's position?"
- "The Wandering Markets have been in 3 cities the party visited. Coincidence?"
- "+ Add Thread" ghost card

**Column 3 — Resolved / Closed:**
- "Clan Mors bounty on Skreek" — closed Session 6 — "Bounty reduced. Snikch in retreat."
- "Oriyen's Archive expulsion" — closed Session 3 — "Context established. Dormant."

Each arc card has: a coloured left border (amber = active, red = threat, grey = resolved), entity chips, session count, and a "View →" link.

Heartflame perched bottom-right: *"The Wandering Markets thread is three sessions old and unnamed. It has a name. The DM hasn't found it yet."*

Annotation callouts:
1. Simmering threads are the DM's hunches — not confirmed arcs yet, but too important to lose
2. Heartflame surfaces the unnamed thread — it notices patterns the DM didn't consciously track

---

**Panel 05 — Campaign Overview: Quick Prep (Session 10 planning)**

The embedded session prep widget from the campaign overview — accessible without navigating away. The DM stays on the overview page but can start planning the next session in a slide-in panel.

Layout: The campaign overview is dimmed behind a right-side drawer panel (~480px wide), sliding in from the right edge.

Drawer header: "Session 10 — Plan" · Close ×

Drawer contents:
- **Session title** — text input, empty, placeholder: *"Name the night."*
- **Scheduled date** — date picker — not yet set
- **Carry-in items** — auto-populated from Session 9 state:
  - ⚠️ Skreek: Poisoned condition unresolved
  - ⚠️ Reality Tear: Concordia Stellaris — open, consequences TBD
  - ⚠️ Draven: alive, knows the party interfered
  - ❓ Pip's unsigned message to Skreek — unresolved
- **Planned encounters** — empty, "+ Add Encounter" button
- **Prep notes** — large freeform text area, Heartflame placeholder: *"What does the world know that the players don't yet?"*
- **World entities to feature** — multi-select chip picker: shows Temmel · Faeren · Draven · Knowledge Serpent as suggestions based on open threads

Bottom of drawer: "Create Session →" amber button · "Save Draft" ghost button

Annotation callouts:
1. Carry-in items are the connective tissue between sessions — auto-surfaced so nothing falls through
2. The drawer stays over the overview — the DM never leaves the campaign context to plan the next session

---

**Panel 06 — Campaign Overview: Mobile (390px)**

The DM at the table, phone in hand, mid-session or between sessions. What does the campaign overview look like on a phone?

This is ruthless prioritisation — everything from panels 01–05 compressed to what a DM actually needs in 5 seconds at the table.

Layout: Vertical stack. No sidebar. Large touch targets.

**Top:** Campaign name "The Shattered Compact" in Cinzel (small display). Below it: one-line world pulse — *"The Serpent is named. The tear is open."* (amber, mono font)

**Quick status strip (horizontal scroll, 3 chips):**
- 🔴 Knowledge Serpent — Threat
- 🟠 Reality Tear — Unstable
- 🟢 Bonfire Keep — Stable

**Session strip (full width card):**
- Current: Session 9 complete
- Next: Not scheduled — "Plan →" button (amber, full width)

**Party (horizontal 3-chip row, large touch targets, 44px min):**
- Norm — HP 51/51 — tap to expand
- Oriyen — HP 67/67 — tap to expand
- Skreek — HP 38/47 ⚠️ Poisoned — tap to expand (amber tint on Skreek's chip)

**Open threads (collapsible list, 3 items shown):**
- "Skreek: Poisoned — unresolved"
- "Reality Tear — consequences TBD"
- "Pip's message — unaddressed"
- "View all 6 →"

**Heartflame** — at the very bottom of the screen, a tiny ember, barely visible. No text. Just present.

Annotation callouts:
1. Mobile strips out everything except party state and open threads — that's all a DM needs mid-session
2. Skreek's chip is amber-tinted before the DM even taps — the condition is visible at a glance

---

*QuiverDM v3.0-alpha1 — Campaign Overview Design Request*
