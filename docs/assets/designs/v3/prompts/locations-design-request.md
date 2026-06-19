> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Locations — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (all panels)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Campaign context:** The Shattered Compact. Locations range from cosmic sanctuaries to corrupted capitals — each one alive in a different way.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real content throughout. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Location List**

The world map's roster — every place the campaign has touched or named.

Layout: Left sidebar (~220px) — filters. Main area: list view (not grid — locations have more metadata than NPCs).

Left sidebar:
- Search bar
- Filter by status: All · Visited · Unvisited · Unstable · Destroyed
- Filter by faction: All · Sunward Empire · Tidal Covenant · Verdant Clans · Neutral
- Filter by type: City · Dungeon · Sanctuary · Wilderness · Cosmic

Main list (each row is a location card, full width, ~80px tall):

- **Bonfire Keep** — Sanctuary · Thornspine Mountains · Visited (Session 6) · Status: 🟢 Stable · Party hub · 3 residents
- **Concordia Stellaris** — Alliance site · Central region · Visited (Session 9) · Status: ⚠️ Unstable · Reality Tear active · Last event: Assassination attempt
- **Aurelios the Golden** — Imperial capital · Sunward Empire · Unvisited · Status: ⚠️ Corruption escalating · 500,000 pop · Serenitas imprisoned beneath
- **The Confluence** — Floating capital · Tidal Covenant · Unvisited · Status: 🟡 Unknown · 300,000 pop
- **The Great Grove** — Living tree-city · Verdant Clans · Unvisited · Status: 🟡 Disrupted · Grove network failing
- **Archive of Withered Echoes** — Repository · Shadowfell · Backstory only · Status: 🔴 Hostile · Knowledge Serpent origin
- **The Sacred Amphitheater** — Sub-location of Concordia Stellaris · Last visited Session 9 · Reality Tear exact location

Each row: location name (Cinzel), type badge, faction chip, visit status, world status dot, one-line summary.

Heartflame top-right: *"Seven places named. Four never visited. The world is larger than the chronicle."*

Annotation callouts:
1. List over grid — locations have denser metadata than NPCs. Status and visit history matter at a glance.
2. Sub-locations (Sacred Amphitheater) are indented under their parent — the world has layers

---

**Panel 02 — Location Detail: Bonfire Keep**

The party's home base — the cosmic sanctuary. This is a safe place, and the design should feel it.

Layout: Two columns. Left (~55%): location profile. Right (~45%): connections and history.

**Left column:**

Location nameplate: "Bonfire Keep" — Cinzel display, large. Subtitle: "Cosmic Sanctuary · Thornspine Mountains · Permanent residents: 3"

Status card (green border): "Stable — Corruption immunity active. Perfect rest. Cosmic clarity."

**Description** (atmospheric, DM-editable):
*"Appears only to worthy heroes. Transcends normal space. The fire at its centre has burned since before the Sunward Empire existed. Temmel tends it. Faeren reads by it. Ambric stands at the edge of its light and says very little."*

**Properties (mechanical):**
- Corruption immunity — all within are immune to entropy corruption effects
- Perfect rest — long rests here restore all resources and remove all conditions
- Cosmic clarity — advantage on checks to understand metaphysical or historical truths
- Temmel's binding — Keep cannot be permanently destroyed while Temmel lives

**Residents section:**
Three NPC chips with portraits: Temmel of the Endless Vigil · Faeren the Story-Bearer · Ambric the Witness
Each chip is tappable → NPC Detail

**Map zone** (below description):
A placeholder zone for a map pin or image upload. Label: "No map uploaded. Drop an image here." Dashed border, soft.

**Right column:**

**Visit history:**
- Session 6 — "Party first arrived. Temmel explained the binding ritual. Faeren showed Oriyen a memory."
- Session 7 — "Brief return. Ambric warned about entropy acceleration."
- Session 9 — "Not visited. Norm tried to reach through the Sacred Flame — session ended before arrival."

**Connected entities:**
NPCs: Temmel · Faeren · Ambric
Items: Anchors' Seal (stored here)
Factions: The Three Anchors

**Open threads:**
- "Norm attempted to reach Bonfire Keep via Sacred Flame during Session 9 — did he make it?"
- "Anchors' Seal: last confirmed location was Bonfire Keep (Session 7)"

Annotation callouts:
1. The "open threads" section turns a static location entry into a living plot hook — DMs don't have to remember, it's surfaced
2. Residents are linked NPCs, not text — tapping Temmel navigates to his full entry

---

**Panel 03 — Location Detail: Concordia Stellaris (Unstable)**

An alliance site mid-crisis. The design should feel different from Bonfire Keep — active, unresolved, dangerous.

Same two-column layout, but the status card is amber/red instead of green.

**Left column:**

Nameplate: "Concordia Stellaris" — Cinzel. Subtitle: "Alliance Base · Sacred Amphitheater · Festival grounds"

**Status card (amber/red border — unstable):**
⚠️ "Reality Tear — active. Location is cosmically compromised. Unknown consequences."
Below: "Sacred Flame: flickering. Thymal's Garden: withered to black."

**Description:**
*"Built on sacred ground where three civilisations made peace. The star-metal amphitheater conducted the original alliance ritual. That ritual was shattered here in Session 9 when Draven's assassination attempt failed — or succeeded in some other way."*

**Sub-locations (indented list):**
- The Sacred Amphitheater — ⚠️ Reality Tear · Star-metal · Exact coordinates of the tear
- Thymal's Garden — 🔴 Withered · "Was a living memorial. Now dead."
- Eastern Colonnade — "Where Draven positioned his soldiers. Session 9."
- Alliance War Council Chamber — "Headquarters. Last meeting: before Session 9."

**Right column:**

**Recent events (Session 9 focus):**
Timeline of what happened here last session — 4 bullet entries in chronological order, linked to transcript moments.

**World state changes since last visit:**
- Reality Tear: opened
- Knowledge Serpent: manifested here
- Draven's forces: positions known to party
- Sacred Flame: status degraded

**Connected entities:**
NPCs: Emperor Aurelias · Captain Draven · Faeren (appeared here) · Knowledge Serpent (manifested)
Factions: Sunward Empire · Tidal Covenant · Verdant Clans

**Open threads:**
- "Reality Tear — still open. What happens at next cosmic alignment?"
- "Eastern Colonnade — Draven's soldiers. What happened after the party intervened?"
- "Sacred Flame — can it be restored? Who knows how?"

Annotation callouts:
1. The unstable status card changes the emotional register of the whole page — same layout, different world-state
2. Sub-locations are tracked as part of the parent — the Tear's exact location is inside the Amphitheater, not floating free

---

**Panel 04 — Location Detail: Aurelios the Golden (Unvisited)**

The Imperial capital — never visited by the party, but enormously important. The world entry exists because the DM has built it in prep.

Same two-column layout. Status: ⚠️ Corruption escalating.

**Left column:**

Nameplate: "Aurelios the Golden" — Cinzel. Subtitle: "Imperial Capital · Sunward Empire · ~500,000 population"

**Status card (amber border):**
"60% of surrounding territory affected by entropy corruption. Serenitas imprisoned beneath the city. Binding ritual chambers deep below. Magical academies draw power from the imprisoned Aspect."

**Description:**
*"The golden city. The party has never stood inside its walls. It exists in the campaign as a weight — the thing that must eventually be faced. The golden scales of Emperor Aurelias are the face of it. The Aspect beneath is the truth of it."*

**DM Prep Notes** (amber-bordered field):
*"The party will reach Aurelios in Arc 2. When they arrive: the corruption is visible in the architecture. Buildings built in the last century lean slightly. The gold has a sickly sheen. The Emperor smiles too widely."*

**Key features (mechanical):**
- Serenitas binding — prison below the Arcanum Quarter
- Corruption aura — creatures spending 1+ week here must make weekly Con saves (DC 12, escalating)
- Imperial magic schools — 3 academies drawing power from Serenitas's imprisonment (unknowingly)

**Right column:**

**Unvisited — DM Context:**
This location has never been visited. Instead of session history, show prep notes:

"What the party knows:"
- Emperor Aurelias rules here
- Serenitas is imprisoned beneath the city
- 60% of surrounding territory shows corruption
- High Sage Lyria Sunweaver is here

"What the party doesn't know:"
- The magical academies are powered by Serenitas
- The binding ritual chambers are accessible from the Arcanum Quarter
- Emperor Aurelias knows Serenitas is conscious

**Connected entities:**
Emperor Aurelias · High Sage Lyria Sunweaver · Serenitas (below) · Sunward Empire

Annotation callouts:
1. Unvisited locations show DM prep notes instead of session history — the structure adapts to the location's status
2. "What they don't know" is a DM-only field — visible in this view, never surfaced to players

---

**Panel 05 — Location: Map Pin View**

The DM has uploaded a world map image and is placing location pins on it.

Layout: Full-width map canvas with a thin control bar at top and a pin panel sliding in from the right.

**Map canvas (main area ~75% width):**
A large atmospheric dark map — illustrated world map style. Mountains, coastlines, forests suggested in dark ink on dark parchment. Not colourful — monochromatic with amber highlights.

Location pins placed on the map (dot + label):
- 🟢 **Bonfire Keep** — placed in the Thornspine Mountains area (north)
- ⚠️ **Concordia Stellaris** — placed in the central plains
- ⚠️ **Aurelios the Golden** — placed in the south, large city marker
- 🔵 **The Confluence** — placed on the northern coast (floating — shown with a wavy underline)
- 🌲 **The Great Grove** — placed in the eastern forest region
- 🔴 **Archive of Withered Echoes** — shown with a different marker style (shadow/Shadowfell indicator) — placed slightly off the main map, at the edge, suggesting it's not on this plane

**Active pin (Concordia Stellaris is selected — amber highlight):**
A small popover appears at the pin: name, status badge, "Open entry →" link, "Move pin" handle.

**Right slide-in panel (~25% width):**
"Map Pins" header. List of all placed pins with status dots. "Add Pin" button. "Upload New Map" button.

Control bar at top: Zoom controls · Reset view · Toggle labels · Toggle fog of war (DM only)

Annotation callouts:
1. Pins carry world status visually — the DM sees the world's health at a geographic glance
2. Shadowfell locations are placed differently — same map, different plane marker, communicating that they're adjacent to but not on the main world

---

**Panel 06 — Location Quick-Create**

The DM is mid-session and needs to add a location that just got named in the transcript. Fast path only.

Layout: Small side panel sliding in from the right (~360px). The rest of the screen (dimmed) shows whatever the DM was looking at — the active session transcript.

Panel header: "Add Location" · × close

**Minimal fields (everything else can be filled in later):**

- Name: "The Ashen Vault" (typed)
- Type: [Dungeon ▾]
- Status: [Unknown ▾]
- Parent location: [Aurelios the Golden ▾] — "Sub-location of"
- Faction: [Sunward Empire ▾]
- One-line note: "Underground, beneath the Arcanum Quarter. Extraction PDF mentioned it — not yet visited."
- Tags: + add

Two buttons: **Add to World** (amber, full width) · **Save & Open Full Entry** (ghost)

Below the buttons, in small mono text: "You can fill in the full entry after the session."

Heartflame in the corner of the dimmed transcript behind the panel: burning low — the session is still live. This is a quick save, not a full edit.

Annotation callouts:
1. The quick-create panel slides over the transcript — the DM never leaves the live session to add a location
2. Minimum viable entry: just a name and a note. The rest is post-session work.

---

*QuiverDM v3.0-alpha1 — Locations Design Request*
