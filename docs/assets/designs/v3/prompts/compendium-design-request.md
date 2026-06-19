> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Compendium Browser — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (panels 01–05) · Mobile 390px (panel 06)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Design note:** The Compendium is the DM's reference library — SRD monsters, items, spells, and rules, plus campaign-specific homebrew. It must be instantly searchable and deeply linkable into the rest of the app.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real content throughout. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Compendium Browser: Monsters**

The DM is looking for enemies to run against the party. Tab active: Monsters.

Layout: Left sidebar (~240px) — filters. Main area: filterable grid/list.

**Left sidebar filters:**
- Search bar: "aberration" (typed)
- CR range: 8–15 (slider)
- Type: ✓ Aberration (checked) · Undead · Beast · Humanoid · Fiend · Dragon
- Source: ✓ SRD · ✓ Homebrew
- Environment: Any
- Size: Any

**Main area — results (filtered, 4 results):**

Switch between Grid and List view — List active.

Results:
- **Aboleth** — Aberration · CR 10 · Large · SRD — "Legendary. Telepathy, Enslave. Mucus cloud." — homebrew badge: none
- **Mind Flayer** — Aberration · CR 7 · Medium · SRD — "Psionic. Brain extraction. Hive-mind." 
- **The Knowledge Serpent** — Aberration · CR 12 · Large · Homebrew · Campaign: The Shattered Compact — "Archive Watcher. Imperial Bloodline Hunter (+3 vs Aurelius family). Chronicle Corruption." — amber homebrew badge
- **Withering Remnant** — Aberration · CR 4 · Medium · Homebrew · Campaign: The Shattered Compact — "Entropy-born undead. Necrotic aura. Serenitas-linked."

Each row: name, type badge, CR badge, size, source badge (SRD or Homebrew+campaign), one-line descriptor, "Open →" link.

The Knowledge Serpent and Withering Remnant have campaign-coloured badges — they're not SRD, they're from The Shattered Compact.

Heartflame top-right: *"Four aberrations in the archive. Two of them are already in your world."*

Annotation callouts:
1. Homebrew monsters from the campaign appear alongside SRD — the Compendium is one library, not two
2. "Already in your world" is implicit from the campaign badge — no separate indicator needed

---

**Panel 02 — Monster Detail: The Knowledge Serpent**

Full stat block for the campaign's homebrew aberration. The DM clicks it from Panel 01.

Layout: Two columns. Left (~55%): stat block. Right (~45%): campaign context.

**Left column — Stat block:**

Name: "The Knowledge Serpent" — Cinzel display. Badges: Aberration · CR 12 · Large · Homebrew

Stat block (atmospheric, not plain white box):

*"A vast serpentine intelligence that predates the Archive of Withered Echoes. It does not hunt bodies — it hunts chronicles."*

- **AC:** 15 (natural armour) · **HP:** 168 (16d10 + 80) · **Speed:** 30 ft, Swim 60 ft
- **STR** 22(+6) · **DEX** 16(+3) · **CON** 20(+5) · **INT** 22(+6) · **WIS** 18(+4) · **CHA** 14(+2)
- **Saving Throws:** INT +10, WIS +8, CON +9
- **Skills:** History +14, Perception +8, Arcana +10
- **Damage Immunities:** psychic
- **Condition Immunities:** charmed, frightened
- **Senses:** Truesight 120 ft, Darkvision 120 ft · Passive Perception 18
- **Languages:** All, telepathy 120 ft

**Features:**
- **Archive Watcher** — Cannot be surprised in library or archive environments. Knows the contents of any written text within 60 ft.
- **Imperial Bloodline Hunter** — +3 to attack rolls and damage against creatures with Aurelius bloodline.
- **Legendary Resistance (3/day)** — If fails a saving throw, can choose to succeed instead.

**Actions:**
- **Multiattack** — 2 attacks: 1 bite, 1 constrict
- **Bite** — +10 to hit · Reach 15 ft · 3d10+6 piercing + 4d6 psychic
- **Constrict** — +10 to hit · Reach 10 ft · 3d6+6 bludgeoning · Grappled DC 18
- **Chronicle Corruption (Recharge 5–6)** — Target: one creature that has written or read a chronicle. DC 17 INT save or have one memory replaced with false information (DM's choice). Concentration, 1 hour.

**Legendary Actions (3):**
- Detect · Tail Sweep · Chronicle Read (2 actions)

**Right column — Campaign context:**

**In your world:**
- Status: Active Threat
- Campaign: The Shattered Compact
- First appeared: Session 9
- Linked to: Oriyen Vale (hunting), Archive of Withered Echoes (origin), Fragment of Obsidian Mirror (trigger)

**DM Prep Notes:**
*"Targets Oriyen first. Has already read some of his memories through the cracked mirror. Does not want to kill the party — it wants to collect Oriyen's complete archive. Violence is a last resort."*

**Session appearances:**
Session 9 — "Named by Oriyen. Manifested at Concordia Stellaris via the Reality Tear."

Action row: [Edit Stat Block] [Use in Encounter] [Open World Entry →]

Annotation callouts:
1. Campaign context lives beside the stat block — a DM doesn't flip between screens to understand a monster's role
2. "Use in Encounter" is the primary action — the Compendium feeds directly into the Encounter Builder

---

**Panel 03 — Compendium Browser: Items**

The DM is browsing items — looking for something to give the party or reference a campaign item.

Layout: Same sidebar + main area structure. Tab active: Items.

**Left sidebar filters:**
- Search bar: empty
- Rarity: ✓ Rare · ✓ Artifact (checked) · Uncommon · Common · Very Rare · Legendary
- Type: Weapon · Armor · Wondrous · ✓ Wondrous (checked) · Consumable
- Attunement: Required only (toggle ON)
- Source: ✓ SRD · ✓ Homebrew

**Main area — Grid view (active, 3 columns):**

Row 1 (Rare, Wondrous, Attunement):
- **Bag of Holding** — SRD · Wondrous · Uncommon · No attunement — "Extradimensional space..."
- **Cloak of Elvenkind** — SRD · Wondrous · Uncommon · Attunement — "Advantage on Stealth..."
- **Duskfall Blade** — Homebrew · Weapon · Rare · Attunement — Campaign: Shattered Compact — amber badge

Row 2 (Artifacts):
- **Fragment of Obsidian Mirror** — Homebrew · Wondrous · Artifact · Attunement — "Reflection of Regret. Scholar's Clarity." — amber badge · ⚠️ CRACKED
- **Warpstone Shard** — Homebrew · Wondrous · Uncommon · No attunement — "Corruption Shield." — amber badge
- **Anchors' Seal** — Homebrew · Wondrous · Artifact · Attunement — "Connects the Three Anchors. Memory Resonance." — amber badge

Status indicator on Fragment of Obsidian Mirror: a small ⚠️ CRACKED badge — world state from Session 9 surfaced here.

Heartflame in the corner: *"Three artifacts in the world. All three are in someone's hands. That is not a coincidence."*

Annotation callouts:
1. Campaign homebrew items show world status (CRACKED) — the Compendium reflects current world state, not just static definitions
2. Heartflame's observation about the three artifacts is a DM hook — it noticed something the DM might not have consciously tracked

---

**Panel 04 — Item Detail: Duskfall Blade**

Full item entry — a campaign-critical weapon currently in an enemy's hands.

Layout: Single wide column, ~720px. More elegant than the monster stat block — items are objects, not creatures.

**Item identity:**
Name: "Duskfall Blade" — Cinzel display, large
Type row: Weapon (Longsword) · Rare · Requires Attunement · Homebrew · Campaign: The Shattered Compact

**Atmospheric description:**
*"Blessed by Serenitas in her uncorrupted form — a weapon meant to bring peaceful endings. Now corrupted by centuries of imprisonment. The blade still seeks endings. It no longer cares what kind."*

**Properties:**
- Damage: 1d8 slashing + 1d4 necrotic · +1 to attack and damage rolls
- **Withering Strike:** On a critical hit, the target must make a DC 13 Constitution saving throw or gain the Withered condition (DM defined: –1d4 to all CON-based checks, ends after long rest)
- **Curse — Entropy Dreams:** After each combat in which this blade is used, the wielder experiences vivid dreams of peaceful endings. Wis save DC 11 or spend next short rest unsettled (no benefit from short rest hit dice).

**Current status:**
⚠️ "Wielded by Captain Draven — corrupted. Draven hears the blade whisper about 'beautiful endings'. His hand trembles when touching it."
World entry link: Captain Marcus Draven →

**Campaign history:**
- Created: Session 5 prep (never appeared in session)
- First mentioned in session: Session 9 (1:36:22) — Oriyen identified it
- Current wielder: Captain Draven

**Linked entities:**
Captain Draven (wielder) · Serenitas (original creator) · Withered condition (defined in rules)

Actions: [Edit Item] [Transfer to Party] [Open in Encounter] [Remove from World]

Annotation callouts:
1. "Current status" reflects world state — the Compendium entry knows who has the blade and what they're doing with it
2. Campaign history connects the item to story moments — not just mechanics, but narrative trajectory

---

**Panel 05 — Compendium: Rules Reference**

The DM needs to look up a rule mid-session. Fast reference, not a wiki.

Layout: Full-width. Tab active: Rules. This is the most utilitarian panel — it should be clean and instant.

**Search bar (large, prominent, top):**
Typed: "concentration"

**Results — instant, no submit:**

**Concentration (PHB p. 203)** — Highlighted result card:

Rule summary (not the full text — the key mechanical points):
- Only one concentration spell at a time
- Taking damage: Con save DC = max(10, half damage taken)
- Distracted or incapacitated: auto-fail
- Spells that require concentration: noted in their description
- Duration: up to the spell's stated duration

Below summary: **In your session right now:**
- Norm Alfella — Hex on Captain Draven (active)
- Captain Draven — Entropy Shroud (Con save pending — took 24 damage from Oriyen)

The rules lookup surfaces live campaign context — the DM doesn't just get the rule, they get the rule applied to their current situation.

Related rules (below the main result):
- Saving throws → · Conditions: Incapacitated → · Counterspell and Concentration →

Secondary results (other mentions of "concentration"):
- Spells requiring concentration (full list, collapsed) →
- Druid Wild Shape and concentration →

Heartflame very faint: *"Two concentration spells. One of them is about to break."*

Annotation callouts:
1. Live campaign context below the rule — the Compendium knows who's concentrating right now and surfaces it
2. Heartflame's note is a countdown, not a tooltip — it knows Draven's Con save is pending

---

**Panel 06 — Compendium: Mobile Reference (390px)**

The DM's phone during combat. They need a rule or a stat block right now.

Layout: Vertical stack. Search-first design — the search bar is the whole screen's reason for being.

**Top:** "Compendium" in small Cinzel · Tab chips: Monsters · Items · Spells · Rules — Rules is active (amber tint)

**Search bar (full width, large, 52px):**
"stunning strike" (typed). Keyboard visible below in wireframe.

**Results (2 results, full width cards):**

**Stunning Strike — Monk Feature (Lv 5):**
- Trigger: After hitting with a monk weapon or unarmed strike
- Cost: 1 Ki point
- Effect: Target makes Con save (DC 8 + proficiency + WIS mod)
- On fail: Stunned until end of your next turn
- Stunned: incapacitated, can't move, auto-fail STR/DEX saves, attacks against have advantage

**Oriyen's DC: 14** — pulled from Oriyen's sheet (WIS +3 + Prof +4). In amber, JetBrains Mono.

**Stunned condition (linked result):**
One-liner: "Incapacitated, speed 0, attacks vs have advantage, fails STR/DEX saves."
Expand → for full condition text.

Bottom sticky bar: 🔍 Search · ⚔️ Monsters · 🗡️ Items · 📜 Rules (active)

Annotation callouts:
1. "Oriyen's DC: 14" appears automatically — the Compendium knows whose character is asking
2. Linked conditions expand in place — no navigation, no back button, just the information

---

*QuiverDM v3.0-alpha1 — Compendium Browser Design Request*
