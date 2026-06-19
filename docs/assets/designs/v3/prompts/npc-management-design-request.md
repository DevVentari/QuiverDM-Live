> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** NPC Management — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (all panels)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, component placement, real content. Annotation callouts per panel.
**Campaign context:** The Shattered Compact. The NPC roster is deep — anchors, corrupted captains, cosmic serpents, shapeshifters.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real campaign content throughout. 1–2 annotation callouts per panel (numbered circles + legend beneath). Dark design system. Cinzel for display, Bricolage Grotesque for body, JetBrains Mono for stats.

---

### THE SIX PANELS

---

**Panel 01 — NPC List (World roster)**

The full NPC roster for The Shattered Compact. The DM's view of every soul in the world.

Layout: Left sidebar (~220px) for filters + search. Main area: a grid of NPC cards (3 columns), not a table. Cards feel like files pulled from a cabinet — portrait zone, name, role, last seen.

Show 9 NPC cards:

Row 1:
- **Temmel of the Endless Vigil** — Anchor of Redemption · Bonfire Keep · Last seen: Session 9 · Status: Active
- **Faeren the Story-Bearer** — Anchor of Memory · Shapeshifter · Last seen: Session 9 (NEW) · Status: Active
- **Ambric the Witness** — Anchor of Justice · Kalashtar · Last seen: Session 6 · Status: Active

Row 2:
- **Emperor Aurelias Draconius** — Ruler · Sunward Empire · Last seen: Session 8 · Status: Active
- **Captain Marcus Draven** — Corrupted · Imperial Guard · Last seen: Session 9 · Status: THREAT (red badge)
- **The Knowledge Serpent** — Aberration · Archive-born · Last seen: Session 9 (NEW) · Status: THREAT (red badge)

Row 3:
- **High Sage Lyria Sunweaver** — Advisor · Sunward Empire · Last seen: Session 7 · Status: Active
- **Serenitas the Twilight Shepherd** — Aspect of Entropy · Imprisoned · Last seen: never directly · Status: COSMIC THREAT (deep red)
- **+ Add NPC** — ghost card, dashed border, amber + icon

Left filter sidebar: search bar at top, then filter pills: All · PCs · NPCs · Threats · Anchors · Factions. Active filter: "NPCs". Below: a tag cloud of faction names.

Heartflame at the top of the main area, a faint scroll: *"No souls walk this world yet"* replaced with *"Eleven names. Two of them are watching back."*

Annotation callouts:
1. Card grid over table — DMs think in faces and names, not rows and columns
2. THREAT status is a world-state signal, not just a label — it follows the NPC across every surface

---

**Panel 02 — NPC Detail: Stat Block (Temmel of the Endless Vigil)**

The full NPC detail page. This is the hardest screen in the app — it must hold a D&D stat block without becoming a table dump.

Layout: Two columns. Left (~55%): the living NPC profile — portrait zone (atmospheric, painterly), name in Cinzel display, subtitle (role + alignment + CR), then tabbed sections below: **Overview · Stat Block · Relationships · Session History**. Active tab: Stat Block.

Show the stat block for Temmel (CR 10, Anchor of Redemption):

Display in a structured but atmospheric way — not a plain white box, not the basic SRD style. The stat block breathes. Use the stone-card aesthetic.

- **Core stats:** AC 16, HP 112, Speed 30 ft — in a compact row
- **Ability scores:** STR 18 / DEX 12 / CON 16 / INT 14 / WIS 20 / CHA 17 — displayed as 6 hexes or compact tiles, modifier below each
- **Saving throws:** Wis +9, Cha +7 (highlighted)
- **Skills:** Insight +9, History +6, Persuasion +7
- **Special:** Immunity to charm and fear · Cannot be permanently destroyed while Bonfire Keep stands
- **Features (abbreviated):**
  - Burden Bearer — can absorb curse or condition from a creature touching him
  - Sanctuary Keeper — Bonfire Keep provides perfect rest to all within
  - Redemption Aura — creatures within 30 ft have advantage on saves vs corruption

Right column (~45%): contextual info panel — recent mentions (session list, most recent first), quick notes field (DM-only), faction tag (Three Anchors), relationship count badge ("4 connections").

Annotation callouts:
1. The stat block is immersive but scannable — a DM needs to find AC in under 2 seconds during combat
2. Right panel is the "so what" — stat numbers mean nothing without campaign context

---

**Panel 03 — NPC Detail: Relationships Tab (Faeren the Story-Bearer)**

Same NPC detail layout, but the Relationships tab is active. This is where the campaign graph lives.

Left column: relationships visualised as a simple spoke-and-hub diagram centred on Faeren — not a full force-graph, just her direct connections. Each connection has a label on the line:

- Faeren → Temmel: "Co-anchor · Centuries of shared vigil"
- Faeren → Ambric: "Co-anchor · Trust, rarely spoken"
- Faeren → Oriyen Vale: "Warned him of the Serpent · Session 9"
- Faeren → Scribe Valdris: "Wore his face · Historical · Deceased"
- Faeren → The Knowledge Serpent: "Opposing forces · Memory vs Corruption" (red line)

Each node is clickable (annotate as →NPC detail for that entity). PC nodes (Oriyen) are visually distinct from NPC nodes.

Below the diagram: a freeform "Relationship Notes" field. Current note: *"Faeren chose Scribe Valdris's face deliberately — Oriyen would recognise it. She's been watching Oriyen longer than the party knows."*

Right column: same contextual panel as Panel 02, but with a "Connections" list replacing the stat block summary — each relationship listed as a row with the relationship type badge and last-interaction session.

Annotation callouts:
1. Relationships are the most valuable thing a DM tracks — and the thing every other tool ignores entirely
2. The DM's private note field is for things the players should never see. It persists. It matters.

---

**Panel 04 — NPC Detail: Session History Tab (Captain Marcus Draven)**

Same NPC detail layout. Session History tab active. Draven is a recurring, escalating presence — his session history tells his corruption arc.

Left column: a vertical timeline of sessions where Draven appeared. Each entry is a card:

- **Session 5** — "First mention. Helena Torres referenced him as her superior. No direct appearance."
- **Session 7** — "Direct scene. Draven briefed the party on Imperial Guard movements. Seemed loyal. Norm noticed his hand trembling."
- **Session 8** — "Draven absent from expected position at Concordia Stellaris. Torres covering."
- **Session 9 (CURRENT)** — "Faeren confirmed: Draven is moving soldiers into position. Duskfall Blade active. Assassination imminent." — Status badge: THREAT · IN PROGRESS

Each card shows: session number, brief DM note, entity mentions (linked). The Session 9 card has an amber left border — it's the current session, still live.

Right column: NPC summary card — name, CR 10, role (Corrupted Imperial Guard Captain), status (THREAT), alignment (Lawful Evil — corrupted). Then: "Items Carried" — Duskfall Blade (linked item entry). "Associated Factions" — Sunward Empire (corrupted arm). "Last Known Location" — Concordia Stellaris, eastern colonnade.

Heartflame at the bottom of the left column: *"He has been changing since Session 5. The hand trembling was the first sign."*

Annotation callouts:
1. Session history makes NPCs feel like living characters — their arc is visible at a glance
2. Heartflame surfaces the DM's own forgotten breadcrumbs — the trembling hand was noted in Session 7 and never followed up

---

**Panel 05 — NPC Quick-Create (AI-assisted)**

The creation flow for a new NPC. Not a long form — the DM is probably doing this mid-session or the night before. It needs to be fast.

Layout: Centred card, ~700px wide. Dark overlay background. Header: "New NPC" in Cinzel.

Show two states side-by-side at half-width each — or show one active state with the other ghosted below:

**State A — Seed input (what the DM types first):**
A single large textarea, styled like parchment. Placeholder in Heartflame's voice: *"Name the soul. Describe what the party will see. The rest follows."*

DM has typed: "Scribe Valdris — elderly human archivist, long dead. Only appears through Faeren's shapeshifting. Was Oriyen's first mentor at the Archive of Withered Echoes before it fell to corruption."

Below the textarea: a "Generate" button (amber). And a row of quick-select tags: NPC · Monster · Ally · Neutral · Threat · Historical

**State B — AI-generated draft (what appears after Generate):**
The stat block draft populates alongside the seed text. Show the generated entry in collapsed form:
- Name: Scribe Valdris (Historical)
- Type: NPC — Human Commoner (modified) · CR ¼ · Deceased
- Role: Former archivist, Archive of Withered Echoes
- Key trait: Oriyen's mentor — advantage on Insight checks regarding Oriyen's choices
- Notes (AI-generated): "No combat stats — Valdris is a ghost of memory, not a combatant. If he appears, it is through Faeren."

At the bottom: [Add to World] [Edit] [Discard]. The DM can edit any field inline before committing.

Annotation callouts:
1. Seed-first creation: the DM describes the fiction, the AI writes the stats — not the other way around
2. Historical NPCs are first-class citizens — not every soul in the world is alive or combatant

---

**Panel 06 — NPC List: Search & Filter (active state)**

Back to the list, but showing the search and filter system in full use. The DM is mid-prep, looking for something specific.

Layout: Same as Panel 01, but:
- Search bar has text: "serpent"
- Results: filtered to 1 result — The Knowledge Serpent — shown large and centred in the grid area, with the other cards dimmed/absent
- The Knowledge Serpent card is expanded slightly — shows its THREAT badge, "Aberration · Archive-born", last seen Session 9, a one-line stat preview: "CR 12 · AC 15 · HP 168 · Darkvision 120ft"
- Below the card: a "Related entities" strip — showing three linked chips: Oriyen Vale (target) · Archive of Withered Echoes (origin) · Fragment of Obsidian Mirror (trigger item)

Left sidebar: active filters shown — Type: Aberration · Status: Threat · Tag: Session 9. A "Clear all" link.

Above the grid: a sort bar — "Sorted by: Last seen" with options: Name / CR / Last seen / Status.

Empty state shown in the peripheral grid area (other cards gone): faint ghost text in the dark background: *"Nothing stirs in the archive."* — but overridden by the one match.

Annotation callouts:
1. Related entities strip turns a search result into a world context view — the Serpent doesn't exist alone
2. The empty-state voice persists even when partially populated — Heartflame is always present

---

*QuiverDM v3.0-alpha1 — NPC Management Design Request*
