> Paste the full contents of `v3-master-design-prompt.md` above this block first.
> Then paste this block below it as the DESIGN REQUEST.

---

## DESIGN REQUEST

**Page / Component:** Combat HUD — three views (Player, DM, Theatre of the Mind)
**Viewport:** Desktop 1440px for DM views · Mobile 390px for Player view
**State:** Active combat — mid-fight, round 3, mixed PC/enemy turn order
**Campaign context:** The Shattered Compact, Session 9. Combat at Concordia Stellaris. Party vs Captain Draven (corrupted) and two Withering Remnants (scaled undead).

Produce three separate, self-contained HTML wireframes — one file per view. Name them clearly in a heading comment at the top of each file.

---

### VIEW 1 — Player Combat HUD (Mobile 390px)

The player's personal combat panel — their view of their own character during a fight. This is what a player sees on their phone at the table. It does one job: tell the player exactly what they have left to spend this turn.

**Layout:** Vertical stack. Top-to-bottom: character identity strip → HP + conditions → action economy → abilities/spells → quick roll button.

**Show for Skreek Swicschnout** (Skaven Rogue / Assassin):

**Action Economy** — the core of this view. Three large buttons/tiles, each takes up a full tap target (min 44px height):
- **Action** — USED (greyed out, with a small "Sneak Attack" label showing it was used for the attack)
- **Bonus Action** — AVAILABLE (lit, amber pulse)
- **Reaction** — AVAILABLE

When the transcription system detects Skreek took an action this turn, the Action tile dims automatically. Show this with a "detected via transcript" micro-label underneath in mono text. The player can also tap to toggle manually.

**HP Strip:**
- Current HP: 38 / 47
- Warpstone Shard charges: 2 remaining (small icon row)
- Condition: Poisoned (muted red badge — from a Remnant's attack)
- No concentration (Skreek is not a caster)

**Abilities available this turn** (compact scrollable list, one line each):
- Sneak Attack — ✓ used
- Cunning Action: Dash / Disengage / Hide — available (Bonus Action)
- Uncanny Dodge — available (Reaction)
- Warpstone Shard: Corruption Shield — available (Reaction)

**Assassinate** — greyed out, tooltip: "Only triggers on surprised targets — Round 1 only"

**Quick Roll:** A large amber button at the bottom — "Roll Damage" — opens a simple dice popup (2d6 + 3 piercing, Sneak Attack already included).

**No chat, no map, no initiative tracker.** This is eyes-down, one-handed, stress-proof. If it needs more than one glance to read, it's too complex.

---

### VIEW 2 — DM Combat Tracker (Desktop 1440px)

The DM's full combat control surface. Runs the fight: initiative, HP, conditions, concentration, and threat awareness — all in one screen.

**Layout:** Full-width initiative track across the top (horizontal cards, one per combatant) → detail panel below that expands when a combatant is selected.

**Combatants (in initiative order):**
1. **Oriyen Vale** — PC / Monk — HP 67/67 — No conditions — No concentration — Turn: NOT YET
2. **Withering Remnant A** — Enemy — HP 19/38 — Condition: Prone — No concentration
3. **Skreek Swicschnout** — PC / Rogue — HP 38/47 — Condition: Poisoned — No concentration
4. **Captain Draven** ← CURRENT TURN — Enemy (Boss) — HP 72/95 — Condition: Frightened (ends start of his turn) — Concentration: Entropy Shroud (spell — fragile, took 24 damage last round, Con save pending)
5. **Norm Alfella** — PC / Warlock — HP 51/51 — No conditions — Concentration: Hex on Draven
6. **Withering Remnant B** — Enemy — HP 0/38 — DEAD (greyed card, collapsed)

**Current turn indicator:** Draven's card is highlighted amber/pulsing. A round counter shows "Round 3" in Cinzel top-right.

**Selected combatant detail panel (Draven expanded):**
- HP bar with inline edit: tap the number to type new HP. Quick +/- buttons for common damage values.
- Conditions list with remove buttons: Frightened (expires start of turn — auto-removal prompt showing)
- **Concentration tracker (CRITICAL):** Red/orange warning card — "Concentration: Entropy Shroud — Con save required (24 dmg received, DC 12). Resolve before his turn." Button: "Roll Save" (DM rolls, taps result).
- Action economy summary: Action / Legendary Action (0/3) / Bonus Action / Reaction — Draven hasn't acted yet this turn.
- Quick actions: Add Condition · Deal Damage · Heal · Kill · Remove from Combat

**Sidebar (right, 280px):**
- Monster stat reference for Draven: AC 16, Speed 30, key resistances (necrotic, poison). His Duskfall Blade entry with damage notation.
- Active spell tracking: Norm's Hex → target: Draven (lit amber); Draven's Entropy Shroud → concentration at risk (lit red).
- Round log: last 3 round events in mono text. "Rd 2: Remnant A → Skreek, 12 piercing + Poisoned. Oriyen → Draven, 24 bludgeon (Con save pending)."

**No map.** Theatre of the mind only. The DM knows where everyone is. This is state management, not spatial.

---

### VIEW 3 — Theatre of the Mind / Storytelling Scene (Desktop 1440px, split DM + Player)

A dual-surface screen for narrative moments — RP encounters, dramatic reveals, NPC confrontations, location arrivals. Not a combat tracker. The world speaking to the players.

**This view has two halves — show them side by side in the wireframe:**

**LEFT HALF (DM Control Surface — 480px):**
The DM's "broadcast deck." A stack of revelation cards the DM can push to the player display. Each card is a chunk of world information.

Show a populated deck for the current scene: The party has just arrived at Concordia Stellaris and is about to meet Faeren the Story-Bearer.

Cards in the deck (vertical list, draggable to reorder):
- 📍 **Location reveal** — "Concordia Stellaris" — subtitle: "The Alliance's sacred ground. Star-metal amphitheater, two moons rising." Status: **SENT** (dimmed, green checkmark)
- 🧑 **NPC reveal** — "Faeren the Story-Bearer" — quick preview: shapeshifter, Anchor of Memory, wearing Scribe Valdris's face. Status: **QUEUED** (ready to send, amber)
- ⚠️ **Threat reveal** — "The Knowledge Serpent" — preview: "It entered through Oriyen's chronicle." Status: **HIDDEN** (dark, lock icon — DM hasn't shown this yet)
- 📜 **Lore drop** — "The Binding Ritual" — brief text. Status: **HIDDEN**
- 🗡️ **Item reveal** — "Duskfall Blade" — seen on Draven. Status: **QUEUED**

Each card has: Send to Players · Hide · Edit · Reorder handle.

Below the deck: a freeform **Scene Notes** text area — DM's scratchpad, never shown to players. Current note: "Faeren will shift faces twice during this scene. First: Scribe Valdris. Second: someone Norm recognises (his mentor?). Don't reveal yet."

A **Heartflame** perch in the corner with a note: *"Faeren has worn eleven faces in this world. Nine of them are gone."*

**RIGHT HALF (Player Display — fills remaining width, ~900px):**
The atmospheric view players see on a shared screen or TV at the table. Full immersion. No DM clutter.

**Currently showing:** Faeren the Story-Bearer card (just sent).

Layout:
- Large atmospheric portrait zone (top 60%) — illustrated silhouette of a figure mid-transformation, ink bleeding into night air. Dark, painterly. No photo-realistic stock art.
- **Location nameplate** — "Concordia Stellaris" — Cinzel, amber, bottom of portrait zone.
- **Entity nameplate** — "Faeren the Story-Bearer" — large Cinzel display text.
- **Subtitle** — "Anchor of Memory · Ageless · Shapeshifter" — Bricolage Grotesque, muted.
- **Description text** — 2–3 sentences of atmospheric prose. In Heartflame's voice: *"She is wearing a face she borrowed centuries ago. The edges of it blur, ink returning to the inkpot. Whatever she was before this moment, you will not know tonight."*

Below the description:
- A subtle **faction tag** — "Bonfire Keep · The Three Anchors"
- An amber **ambient glow** pulses softly behind the portrait — indicating this is a live/active reveal, not static.

When the DM queues the next card (Duskfall Blade), show it as a **slide-in preview** at the bottom edge of the player display — a small card peeking in, not yet fully revealed.

**This view has no UI chrome for players** — no nav, no buttons, no session controls. Just world.

---

*QuiverDM v3.0-alpha1 — Combat HUD Design Request*
