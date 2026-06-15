> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Character Sheet — 6-panel low-fidelity exploration
**Viewport:** Desktop 1440px (panels 01–05) · Mobile 390px (panel 06)
**State:** One HTML file. Six wireframe panels in a 2×3 grid. Low-fidelity style — structure, hierarchy, real content. Annotation callouts per panel.
**Design challenge:** The character sheet is the hardest UI problem in D&D apps. It must hold a full 5e sheet without becoming a wall of numbers. It must feel like a living document, not a form. It must work in combat at 44px touch targets.

---

### THE FORMAT

Six labelled wireframe panels in a 2×3 grid, each ~680×460px. Real character data throughout — use the actual stat blocks from the campaign. 1–2 annotation callouts per panel. Dark design system.

---

### THE SIX PANELS

---

**Panel 01 — Character Sheet: Core (Skreek Swicschnout)**

The default view when opening a character sheet. Everything the player needs to know about their character in one glance. Not everything — the right things.

Layout: Two columns. Left (~340px): identity + core stats. Right (~remainder): skills, saving throws, features.

**Left column:**

Character identity strip at top:
- Name: "Skreek Swicschnout" — Cinzel display, large
- Class + Level badge: "Rogue (Assassin) · Lv 5" — Bricolage, muted
- Race badge: "Skaven" — with a small icon indicator
- Alignment: Chaotic Good · Background: Escaped Experiment

HP block — large and prominent (this is what the player checks most):
- Current HP: **38** — large JetBrains Mono, amber
- Max HP: / 47 — smaller, muted
- Temp HP: — (none)
- HP bar beneath — 38/47 fill, amber
- Condition: ⚠️ Poisoned — amber badge below the bar

Six ability scores in a compact 2×3 grid of tiles:
- STR 8 (–1) · DEX 15 (+2) · CON 13 (+1)
- INT 9 (–1) · WIS 11 (+0) · CHA 17 (+3)
Each tile: score large, modifier below, proficiency indicator dot if applicable.

Below ability scores:
- AC: 14 · Initiative: +2 · Speed: 35 ft / Climb 15 / Swim 20 / Burrow 1
- Darkvision: 60 ft
- Passive Perception: 12

**Right column:**

Saving throws (compact list, proficient ones marked with amber dot):
DEX ✦ +5 · STR –1 · CON +1 · INT –1 · WIS +0 · CHA +3

Skills (two sub-columns, proficiencies highlighted):
- Acrobatics ✦ +5 · Sleight of Hand ✦ +5 · Stealth ✦ +5
- Perception ✦ +3 · Intimidation ✦ +6 · Persuasion ✦ +6
- Others at base value, muted

**Tab bar** beneath identity strip (for the full sheet): Core · Actions · Features · Inventory · Story. Active: Core.

Annotation callouts:
1. HP is the biggest element on the sheet — players check it constantly, it earns the space
2. Conditions live adjacent to HP, not buried in a status tab — they affect every decision

---

**Panel 02 — Character Sheet: Actions (Norm Alfella)**

The combat-ready tab. Everything a player needs to act on their turn. No flavour text, no backstory — just "what can I do right now."

Layout: Single wide column with clear section breaks. Tab active: Actions.

**Attacks section:**
One card per attack/cantrip usable as an action. Each card: name, attack bonus, damage, range, tags.
- **Eldritch Blast** — +7 to hit · 1d10 force · 120 ft · Ranged · (Hex bonus: +1d6 necrotic if Hex active)
- **Dagger** — +4 to hit · 1d4+2 piercing · 20/60 ft · Finesse · Light

**Pact Magic section:**
Skreek has no spell slots — but show Norm's Pact Magic properly.
- Slot level: 3rd · Slots: ☐☐ (2 available — shown as two amber circles, filled = used, empty = available)
- Recharge: Short Rest

**Spells known (by level):**
Cantrips (always): Eldritch Blast · Mage Hand · Minor Illusion
3rd Level (2 slots): Hex · Hypnotic Pattern · Fear · Hunger of Hadar · Counterspell
Each spell: name, casting time icon (action/bonus/reaction), concentration tag if applicable, a small "Cast →" affordance.

**Concentration tracker:**
A dedicated strip — currently: Hex active on Captain Draven. Amber pulsing indicator. "Concentration: Hex (Draven)" with a break button × and a "Con save DC" reminder on the right.

**Bonus Actions:**
- Hexblade's Curse (if multiclassed — or leave as empty section)
- Nothing currently available

**Reactions:**
- Counterspell — available
- Hellish Rebuke — available (if applicable)

**Special Features used this session:**
- Goblin Camaraderie — Used ✓ (greyed, with session note: "Used in Session 9 - Concordia Stellaris")

Annotation callouts:
1. Pact Magic slot circles beat a number — empty/filled state is scannable in a glance across the table
2. Concentration tracker is inline, not buried — a player can't "forget" they're concentrating if it's always visible

---

**Panel 03 — Character Sheet: Features & Traits (Oriyen Vale)**

Class features, racial traits, and special abilities. The "how does my character work" tab. Tab active: Features.

This is the most text-dense tab — the challenge is making it readable without being a wall.

Layout: Two columns. Left: class features. Right: racial traits + background features + artifact.

**Left column — Monk features (Way of the Blinded Eye, Lv 5):**

Each feature as a compact card with: name, level unlocked (small badge), and 1–2 line description — not the full text, just the mechanical summary.

- **Martial Arts** (Lv 1) — "Unarmed strikes: 1d6. DEX instead of STR for monk weapons."
- **Unarmored Defense** (Lv 1) — "AC = 10 + DEX + WIS = 10 + 3 + 3 = 16"
- **Ki** (Lv 2) — "6 points · Recharge: Short/Long rest" — with 6 pip tracker inline: ●●●●●● (all full)
- **Flurry of Blows** (Lv 2) — "1 ki: 2 bonus unarmed strikes after Attack action"
- **Patient Defense** (Lv 2) — "1 ki: Dodge as bonus action"
- **Step of the Wind** (Lv 2) — "1 ki: Disengage or Dash as bonus action, jump distance doubled"
- **Stunning Strike** (Lv 5) — "1 ki after hit: Con save DC 14 or stunned until end of next turn"
- **Way of the Blinded Eye: Emotional Mimicry** (Lv 3) — "Read surface emotions, advantage on Insight vs creatures studied 1+ rounds"
- **Way of the Blinded Eye: Battlefield Absence** (Lv 6 — locked) — greyed with 🔒

**Right column:**

Racial traits (Shadowfell — custom):
- Darkvision 60 ft
- Shadow Step (short-range teleport, 1/short rest — if applicable)
- Evasion (Lv 7 — locked, greyed)

Background trait:
- Archive Scholar — Advantage on History checks related to Shadowfell institutions

**Artifact: Fragment of Obsidian Mirror**
A special card with amber border — higher visual weight than the feature cards:
- "Reflection of Regret — 1/long rest: 1 min concentration, see consequences of recent decision. Advantage on next Wisdom save."
- "Scholar's Clarity — In Bonfire Keep: +2 to attack with monk weapons, advantage on Investigation/Insight."
- Status: ⚠️ CRACKED — "Mirror cracked in Session 9. Visions may be degraded." — amber warning strip at bottom of the card.

Annotation callouts:
1. Ki points as inline pips on the feature card — the player tracks them without switching tabs
2. The artifact card has a higher visual weight than class features — it's plot-critical, not just mechanical

---

**Panel 04 — Character Sheet: Inventory (Skreek Swicschnout)**

Everything Skreek carries. Tab active: Inventory.

Layout: Left column (~55%): equipped items and carried gear. Right column (~45%): currency + encumbrance + artifact detail.

**Left column:**

**Equipped section** (top, visually distinct):
A body silhouette or slotted layout showing what's currently worn/wielded. Compact — show slot labels with items:
- Weapon (main): Shortsword — 1d6+2 piercing · Finesse
- Weapon (off): Dagger — 1d4+2 piercing · Finesse · Light
- Armor: Leather Armor — AC 12 + DEX
- Special: Enchanted Sleeve (left arm) — "Contains the plague arm. Sylria's enchantment."

**Carried gear** (list below equipped):
- Thieves' tools (proficient) · Rope 50ft · Rations ×4 · Healer's kit · Tinderbox
- Cheese, aged (3 portions) — italicised, a small amber star next to it (Skreek's one true love)

**Right column:**

Currency strip: PP 0 · GP 47 · EP 0 · SP 12 · CP 3

Encumbrance: Current carry 34 lb / Max 120 lb (STR 8 × 15) — green bar

**Artifact card — Warpstone Shard:**
Amber border, slightly elevated treatment:
- "Corruption Shield — Reaction: reduce necrotic or poison damage by 1d4 + CON mod."
- "Insightful Corruption — +2 attack with finesse weapons, advantage on Investigation/Insight in Bonfire Keep."
- Charges: ●○ (1 of 2 spent this session)
- Recharge: Long rest

Below the artifact card: a faint Heartflame callout: *"The cheese is a liability. Also, carry more rope."*

Annotation callouts:
1. Equipped items separate from carried — the player can find "what am I holding" in one glance
2. Artifacts always get elevated card treatment — they're not just gear, they're plot threads with stats

---

**Panel 05 — Character Sheet: Story (Norm Alfella)**

The character's history, personality, and campaign connections. This tab is for the DM and player together — not combat, not mechanics. The soul of the character.

Tab active: Story.

Layout: Two columns.

**Left column:**

**Biography** (freeform text, editable):
"Norm saved a group of children from a witch's kidnapping — the witch stripped and shamed him, cursed his clothing. Banished from his community. Found kinship with goblins who accepted him as he was. The warlock powers came from something that witnessed the injustice and chose him."

**Personality traits** (compact):
- "Reads every situation for who holds the real power — and whether they deserve it."
- "Trusts goblins more than people. Has not yet questioned why."

**Flaw:** "Will sacrifice a good outcome to humiliate someone who deserves it."

**Bonds:**
- Oriyen Vale — "grounding presence. The one person who makes Norm feel like the curse doesn't define him."
- Skreek — "goblin soulmate. They share trauma, humour, and cheese."

**The Curse:** A dedicated card, red border — "Stripped and shamed by the witch. All non-Scavenger's Vest clothing falls away. The vest is the anchor."

**Right column:**

**Session appearances:**
A condensed timeline — session number + one-line contribution per session. Last 4 entries:
- Session 6: "First use of Goblin Camaraderie — Bonfire Keep ambush"
- Session 7: "Hex on the Wandering Market scout — revealed the Continuity Compact"
- Session 8: "Identified Draven's soldiers from faction insignia inconsistency"
- Session 9: "Distracted Draven's vanguard. Saved Skreek 2 rounds."

**DM Private Notes** (amber-bordered field, clearly labelled "DM Only — not visible to player"):
*"Norm still doesn't know the warlock patron's identity. The patron witnessed the witch's shaming. The patron might be Ambric — or something connected to the Three Anchors. Don't confirm yet."*

**Open threads for this character:**
- "Patron identity — unresolved"
- "Witch — location unknown, curse uncured"
- "Goblin Camaraderie: who does Norm call on when this escalates?"

Annotation callouts:
1. DM private notes live on the player's character sheet — the DM has campaign context the player doesn't, and it belongs here
2. Open threads are the DM's hooks — they live on the character so they don't get lost between sessions

---

**Panel 06 — Character Sheet: Mobile Combat View (Oriyen Vale, 390px)**

The player's phone at the table during combat. Everything else falls away. This is the 5-second read.

Layout: Vertical stack, full width. Large touch targets throughout — nothing below 44px.

**Top strip:** "Oriyen Vale" (small Cinzel) · Monk 5 · HP 67/67 — full green bar

**Action economy (3 large tiles, full width, stacked):**
- **ACTION** — AVAILABLE — amber — large text
- **BONUS ACTION** — AVAILABLE — amber
- **REACTION** — AVAILABLE — amber
Each tile is tappable — tap to mark used (dims to grey). One tap, one hand.

**Ki Points:** ●●●●●● — 6 pips in a row, tappable to spend. Current: 6/6.

**Quick attacks (2 cards, full width):**
- **Unarmed Strike** — +5 · 1d6+3 bludgeoning · Tap to roll
- **Shortsword** — +5 · 1d6+3 piercing · Tap to roll

**Conditions:** None active — greyed placeholder "No conditions"

**Stunning Strike reminder** (collapsed card, tap to expand):
"After hit: spend 1 ki. Con save DC 14. On fail: stunned until end of your next turn."

**Bottom persistent strip:** AC 16 · Initiative +3 · Speed 30ft

No backstory. No equipment list. No skills. This is a combat dashboard, not a character sheet. "View Full Sheet →" link at the very bottom for everything else.

Annotation callouts:
1. Action economy tiles are the whole screen's reason for being — tappable, toggleable, legible at arm's length
2. Ki pips are tappable in place — no popup, no number field. Spend a ki: tap a pip.

---

*QuiverDM v3.0-alpha1 — Character Sheet Design Request*
