> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Homebrew Creator — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (all panels)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Campaign context:** The Shattered Compact. The DM is building custom content — NPCs, items, and importing a sourcebook PDF.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real content throughout. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Homebrew Library**

The DM's custom content library — everything they've built or imported that isn't official SRD content.

Layout: Left sidebar (~220px) — filter/nav. Main area: tabbed content grid.

Left sidebar tabs (vertical):
- All · NPCs · Items · Spells · Locations · PDFs · Imported

Active tab: All. Filter: Campaign — "The Shattered Compact"

Main area: Tab bar at top — All / NPCs / Items / Spells / PDFs. Active: All.

Content grid (3 columns, cards):

Row 1:
- **Temmel of the Endless Vigil** — NPC · CR 10 · Custom · Session 6 — "Anchor of Redemption"
- **Duskfall Blade** — Item · Rare · Custom · Session 5 — "Entropy-touched longsword"
- **Warpstone Shard** — Item · Uncommon · Custom · Session 1 — "Skreek's artifact"

Row 2:
- **Withering Remnant** — Monster · CR 4 · Custom · Session 7 — "Scaled undead, Serenitas-born"
- **Knowledge Serpent** — Monster · CR 12 · Custom · Session 9 — "Archive aberration"
- **Fragment of Obsidian Mirror** — Item · Rare · Custom · Session 1 — "Oriyen's artifact"

Row 3:
- **Hamerian Corruption Sourcebook** — PDF Import · 14 entities extracted · 3 weeks ago
- **+ Create New** — ghost card, dashed border, amber + icon
- **+ Import PDF** — ghost card, dashed border, amber PDF icon

Heartflame top-right, faint: *"Forty-seven souls built by hand. The world remembers each one."*

Annotation callouts:
1. PDFs are first-class citizens in the library — imported content sits alongside hand-built content
2. Cards show campaign context (last session mentioned) — homebrew isn't abstract, it's tied to story moments

---

**Panel 02 — PDF Import: Upload & Processing**

The DM drops a PDF sourcebook into QuiverDM. Heartflame goes to work.

Layout: Centred card, ~700px wide. Dark overlay background.

**State A — Upload zone (top half of card):**
A large drag-and-drop zone with a Heartflame illustration centre — the bird perching on a scroll, wings slightly raised.
Text inside: *"Drop a sourcebook, map, or recording here."*
Below: "or Browse Files" — subtle link.
Accepted formats shown in mono: .pdf · .docx · .txt · .png · .jpg

**State B — Processing (bottom half, after upload):**
File name: "Hamerian-Corruption-Sourcebook.pdf" — 47 pages · 8.2 MB

A processing card showing Heartflame actively burning low — no text, just the animation indicator. Below it in mono:
- ✓ PDF parsed — 47 pages
- ✓ Text extracted — 23,400 words
- ⟳ Identifying entities... (progress bar at 60%, amber fill)
- ○ Generating stat blocks
- ○ Building world entries

Estimated time: ~2 minutes — in mono, muted.

Cancel button (ghost) bottom right.

Note at bottom of card: *"Heartflame will surface everything it finds. You decide what enters the world."*

Annotation callouts:
1. Heartflame burns low during processing — no spinner, no percentage. The flame is reading. Don't interrupt it.
2. The extraction pipeline is shown as steps, not a black box — the DM can see what's happening

---

**Panel 03 — PDF Extraction Review**

Heartflame has finished. Here are the entities it found. The DM decides what enters the world.

Layout: Two columns. Left (~45%): extraction queue. Right (~55%): entity preview/edit for the selected item.

**Left column — Extraction queue (14 entities):**

Grouped by type:

NPCs (5):
- ✓ Temmel of the Endless Vigil — Already in world (linked automatically)
- ⚠️ Archon Vethis — New NPC · CR 8 · "Imperial enforcer — not yet in world"
- ⚠️ The Corruptor (unknown) — New NPC · "Ambiguous — possibly Serenitas alias"
- ✓ Captain Helena Torres — Already in world (linked)
- ❓ "The Watcher" — Ambiguous — "Mentioned 3× but no stat block. Lore figure?"

Locations (4):
- ✓ Concordia Stellaris — Already in world
- ⚠️ The Ashen Vault — New location · "Underground, Aurelios the Golden"
- ⚠️ Thymal's Garden — New location · "Withered. Concordia Stellaris."
- ✓ Bonfire Keep — Already in world

Items (3):
- ✓ Duskfall Blade — Already in world (stat block updated with new info)
- ⚠️ Veil of Endless Dusk — New item · Rare · "Entropy-woven cloak"
- ⚠️ Anchors' Seal — New item · Artifact · "Connects the Three Anchors"

Spells/Abilities (2):
- ⚠️ Entropy Shroud — New ability · "Draven's concentration spell"
- ⚠️ Corruption Pulse — New spell · "Serenitas passive"

**Selected item: Archon Vethis** (right column preview):
AI-generated draft:
- Name: Archon Vethis · Type: NPC · CR 8 · Lawful Evil (corrupted)
- Role: Imperial enforcer, reports to Draven
- HP: 78 · AC: 17 (plate) · Speed: 30 ft
- Notable traits: Undying Loyalty (immune to charm/fear from non-Imperial sources), Void-Touched (+1d6 necrotic on melee)
- Description: "A loyal servant who does not yet know his master is gone."
- Source: Extracted from page 14 — transcript excerpt shown in smaller text

Action row: [Add to World] [Edit First] [Ignore]

Heartflame banner at top of right column: *"Fourteen names from forty-seven pages. Three of them already walked in your sessions."*

Annotation callouts:
1. Already-in-world entities are auto-linked — the DM only reviews what's genuinely new
2. "The Watcher" is flagged as ambiguous — the system doesn't guess, it asks

---

**Panel 04 — NPC Creator: AI-Assisted Build**

The DM creates a new NPC from scratch — not from a PDF. Using the seed-first approach.

Layout: Two-column split. Left (~40%): seed input and settings. Right (~60%): live preview of the generated stat block.

**Left column:**

Header: "New NPC" in Cinzel

**Seed textarea** (large, parchment-style):
Label: *"Describe this soul."*
DM has written:
*"Skywright Caravelle Stormwind — captain of a Wandering Markets airship. Human, late 40s. Charming and evasive. Knows far more about the Continuity Compact than she lets on. Not a fighter — a negotiator. Her ship is her domain and her escape route."*

**Settings row (compact):**
- CR: [4 ▾] — dropdown
- Alignment: [Neutral ▾]
- Type: [NPC ▾] (NPC / Monster / Boss / Historical)
- Tags: [Wandering Markets ×] [add +]

**Generate** button — amber, full width.

Below: "Advanced options" collapsed link — expands to: forceProvider, language model, stat complexity level.

**Right column — Live preview:**

Generated stat block draft (appears after Generate):
- **Caravelle Stormwind** · Human NPC · CR 4 · Neutral
- HP: 52 · AC: 13 (dex + studded leather) · Speed: 30 ft
- STR 10 / DEX 16 / CON 12 / INT 17 / WIS 14 / CHA 20
- Skills: Deception +8 · Insight +6 · Persuasion +8 · History +5 · Sleight of Hand +5
- Features:
  - **Silver Tongue** — Advantage on Persuasion, can Disengage as bonus action in conversation
  - **Captain's Domain** — Aboard her ship, advantage on all checks; hostile creatures have disadvantage on attacks
  - **Continuity Contact** — Knows 1d4 plot-relevant secrets. DM chooses which to reveal.
- Personality: *"She smiles when she's hiding something. She always smiles."*

Action row: [Add to World] [Regenerate] [Edit] [Save Draft]

Annotation callouts:
1. The seed is a character description, not a form — the DM writes fiction, the AI writes stats
2. Continuity Contact is a narrative feature, not just mechanical — AI understood the "knows more than she lets on" seed

---

**Panel 05 — Item Creator**

The DM creates a custom item — the Anchors' Seal, an artifact connecting the Three Anchors.

Layout: Single centred column, ~720px wide. Not a split — item creation is simpler than NPC.

**Item identity strip:**
- Name field: "Anchors' Seal" (typed)
- Type: [Artifact ▾] — Wondrous Item / Weapon / Armor / Artifact / Consumable
- Rarity: [Artifact ▾] — Common / Uncommon / Rare / Very Rare / Legendary / Artifact
- Requires Attunement: ✓ (toggle ON) — "by a member of the Three Anchors"

**Description field:**
*"A flat disc of compressed memory, bound in tarnished gold. When held, three faint voices speak at once — Temmel's, Faeren's, and Ambric's. The voices do not speak to the holder. They speak to each other."*

**Properties (add row):**

Each property is a card with: property name, type (passive / active / reaction / attunement), description.

- **Anchor Link (Passive):** "The holder always knows the direction and approximate distance of all three Anchors."
- **Memory Resonance (Active — 1/day):** "As an action: hear a memory shared between the Three Anchors relevant to your current situation. The DM chooses which."
- **Unbreakable Compact (Reaction):** "When a creature within 30 ft would be charmed or frightened, use reaction to grant them advantage on the save."

**+ Add Property** — ghost card below

**Curse field (optional, collapsible):**
Expanded: "The voices grow louder in proximity to entropy corruption. In corrupted areas, the holder hears fragments of Serenitas's imprisonment — distressing but not harmful."

**Linked entities:**
Chips: Temmel of the Endless Vigil × · Faeren the Story-Bearer × · Ambric the Witness × · [add +]

**Save as Draft** · **Add to World** (amber)

Annotation callouts:
1. Artifact rarity unlocks the Curse field — mechanical scaffolding follows the fiction
2. Linked entities connect the item to the world graph — tapping Temmel's chip navigates to his NPC entry

---

**Panel 06 — Homebrew: NPC Edit (post-creation)**

After adding Caravelle Stormwind to the world, the DM opens her entry to make adjustments after Session 10 reveals more about her.

Layout: Full NPC detail page (same structure as NPC Detail panel in the NPC Management request) — but in edit mode. Fields are editable inline.

Header: "Caravelle Stormwind" — with a small "Edit mode" pill badge (amber) and "Viewing" / "Editing" toggle top-right.

**Editable fields shown inline:**
- Description text: cursor blinking in the description field — DM is adding: *"…she offered the party a way off Concordia Stellaris before asking why they needed one. She knew before they said anything."*
- The Continuity Contact feature — DM has clicked it to expand: 3 secrets listed as freeform text fields:
  - "Knows the Continuity Compact's true agenda: preserve world-state across cosmic resets"
  - "Has met Faeren before — in a different face"
  - "(empty — slot 3 not yet revealed)"
- Session tag added: "Session 10" chip added to her session history

**Right column (unchanged from view mode):**
Session history, relationship connections, faction tags — all read-only while editing the left.

Bottom bar: [Cancel] (ghost) · [Save Changes] (amber) · [Delete NPC] (red ghost, far left)

Heartflame bottom-right, a faint line surfacing in its glow: *"Three secrets. Two confirmed. One the DM hasn't decided yet."*

Annotation callouts:
1. Edit mode is inline — no separate edit page, no modal. The DM edits in context of the full entry.
2. Heartflame notices the empty secret slot — a gentle prompt, not a validation error

---

*QuiverDM v3.0-alpha1 — Homebrew Creator Design Request*
