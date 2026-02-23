# TTRPG Ecosystem Research: Expansion Beyond D&D 5e

**Date:** 2026-02-23
**Purpose:** Pitch document research — which TTRPG systems should QuiverDM support, in what order, and what it would take technically.

---

## 1. Market Overview

The global TTRPG market reached an estimated **$1.9–2.0 billion** in 2024, with a projected CAGR of 11–12% through 2035 ($6.6B projected). Active worldwide players exceed **50 million** (up from ~27M in 2018), with 70% playing in weekly sessions.

**D&D's dominant position:**
- ~50%+ of all RPG sales by dollar value
- D&D 2024 Player's Handbook was the fastest-selling D&D product ever
- D&D 5e accounts for 50%+ of Roll20 campaigns
- WotC holds ~48% market share by player engagement

**The non-D&D market is ~26M players** — roughly half the total addressable market — spread across dozens of systems. Paizo alone accounts for ~12% market share with Pathfinder.

### Key 2023–2024 Trend: OGL Flight

Following the WotC Open Game License (OGL) controversy in early 2023, experienced D&D players showed significantly increased willingness to try alternatives, particularly Pathfinder 2e. Paizo's Pathfinder Remastered Core (OGL-free, released 2023–2024) was adopted by over 1.5 million players within six months of launch — the single clearest signal that the non-D&D audience is growing and primed for new tools.

---

## 2. System-by-System Analysis

Rankings are informed by: StartPlaying Games 2024 platform data, Roll20 historical data, ICv2 retail charts, and RPGDrop 2024 industry analysis.

---

### 2.1 D&D 2024 (One D&D / 5e Successor)

| Attribute | Detail |
|---|---|
| Player base | Included in D&D's ~50% market share; 20M+ active fantasy campaign players |
| Existing digital tools | D&D Beyond (official, full integration), Roll20, Foundry VTT |
| Digital tool gaps | D&D Beyond is the incumbent but is WotC-owned and feature-limited for DMs |
| QuiverDM relevance | **QuiverDM already covers 5e; 2024 rules are backward-compatible** |

**Technical delta from 5e:** Minimal. The 2024 rules update is officially "not a new edition" and is designed to be compatible with existing 5e content. The 2024 Player's Handbook introduces updated class features, revised species rules, and background changes — all within the same d20/proficiency bonus/CR framework. QuiverDM's existing encounter math, stat blocks, and session structures apply directly.

**Adoption speed:** Slow. Third-party designers and DMs are holding steady on 2014 rules. QuiverDM should track 2024 rule updates incrementally rather than treating them as a separate system.

**Recommendation:** Support in parallel with 5e — same codebase, flag content as "2024 rules" where applicable.

---

### 2.2 Pathfinder 2e (Paizo)

| Attribute | Detail |
|---|---|
| Player base | #2 globally; ~12% market share; 1.5M+ Remaster adopters in 6 months |
| Existing digital tools | Foundry VTT (best-in-class, official Paizo partnership); Pathbuilder (character builder); PF2 Tools; Roll20 support |
| Digital tool gaps | No dedicated AI-powered session management / transcription tool. Foundry is VTT-focused, not narrative/campaign-management-focused. |
| QuiverDM relevance | High. PF2e GMs face the same session-prep and note-taking burdens as D&D GMs. |

**Technical complexity: Medium-High**

PF2e shares the d20 framework but diverges significantly in:

- **Stat blocks:** Three-action economy (instead of action/bonus action/reaction). All proficiency bonuses scale 1-per-level (vs. D&D's flat +2–+6 range). AC scales with level. Encounter XP uses a relative-level threat budget (not CR).
- **Encounter math:** XP budget based on monster level relative to party level. A monster 4 levels above the party is "Extreme" threat. The multiplier system from D&D is absent — replaced by budgeting threat points.
- **Conditions:** PF2e has ~30 named conditions (Frightened 1–4, Drained 1–4, etc.) with degree-of-success scaling.
- **SRD availability:** Paizo's Archives of Nethys (AoN) provides full ORC-licensed SRD for all monsters, spells, and feats. This is the equivalent of D&D's SRD — freely usable for data.

**Implementation work:**
- New encounter calculator (level-relative threat budget vs. CR/XP)
- New stat block renderer (3-action icons, level-scaling fields)
- Import SRD monster data from Archives of Nethys (JSON-structured, freely available)
- Condition tracker updates
- Character sheet schema update

---

### 2.3 Call of Cthulhu (Chaosium, 7th Edition)

| Attribute | Detail |
|---|---|
| Player base | #5 on StartPlaying 2024; >10% of Roll20 games historically |
| Existing digital tools | Roll20 (strong support, refreshed 2024); Foundry VTT system; Pulp Cthulhu module. No dedicated campaign manager. |
| Digital tool gaps | Investigation/clue-tracking tools are nearly nonexistent. Session notes and session-to-session continuity tools are a significant gap. |
| QuiverDM relevance | Very high for narrative features: session transcription, NPC tracking, clue boards. |

**Technical complexity: Medium-Low**

CoC uses Basic Role-Playing (BRP): percentile dice (d100), roll-under-your-skill mechanic. No concept of encounter CR or combat-as-resource management. The system is investigation-first:

- **Core mechanic:** Roll d100 under skill % = success. Half skill = Hard success. One-fifth = Extreme success.
- **No stat blocks in the D&D sense.** Creatures have characteristics (STR, CON, SIZ, DEX, INT, POW, APP) and skill lists. Sanity (SAN) is a primary resource — not HP.
- **No encounter math.** Combat exists but is often lethal and brief. There is no "balanced encounter" design paradigm.
- **Sessions are investigation-centric.** Players track Clues, Leads, and Contacts across multiple sessions. This is exactly what QuiverDM's NPC/homebrew content management is suited for.

**Implementation work:**
- New character/NPC schema (BRP attributes + skill percentages + SAN)
- Remove/hide encounter math UI (not applicable)
- Add clue/investigation tracker (new feature — high value for CoC)
- Sanity tracker component
- No monster SRD needed for core features (session notes, transcription work as-is)

**Key insight:** QuiverDM's session transcription and NPC management features require essentially zero changes to serve CoC GMs. Only the character/encounter modules need updates.

---

### 2.4 Vampire: The Masquerade 5e (Renegade Game Studios / World of Darkness)

| Attribute | Detail |
|---|---|
| Player base | #3 on StartPlaying 2024; significant horror/gothic fiction crossover audience |
| Existing digital tools | Demiplane Nexus (official, launched full access Oct 2023); Alchemy VTT (2024); Roll20 support |
| Digital tool gaps | Demiplane covers character building and rulebook access but is not a campaign/session management tool |
| QuiverDM relevance | High for NPC factions, political intrigue tracking, session notes — the game's narrative core |

**Technical complexity: Low-Medium**

V5 uses a d10 dice pool system:
- **Resolution:** Pool of d10s (attribute + skill). 6+ = success. Two 10s = messy critical. Two 1s = bestial failure.
- **No encounter math.** Combat is narrative and consequence-heavy — no CR equivalent.
- **Hunger mechanic:** Replaces traditional HP as primary stress resource. Hunger dice substitute into pools and trigger bestial failures.
- **Character sheets:** Attributes (Physical/Social/Mental), Skills, Disciplines (vampire powers), Humanity track, Hunger level (1–5).
- **Session structure:** Political intrigue, faction management, feeding hunts. Sessions are rarely combat-centric.

**Implementation work:**
- New character schema (d10 pools, Discipline powers, Hunger, Humanity)
- Faction/NPC relationship tracker (high value — coteries vs. Camarilla vs. Anarchs)
- Remove encounter math entirely
- Dice roller UI (d10 pools with Hunger dice overlay)

**Key insight:** The Storyteller's role in V5 is more like a novelist-director than a combat tactician. QuiverDM's session summaries, NPC management, and narrative search features map almost perfectly to what V5 Storytellers need.

---

### 2.5 Cyberpunk Red (R. Talsorian Games)

| Attribute | Detail |
|---|---|
| Player base | #6 on StartPlaying 2024; surged post-Cyberpunk 2077 video game |
| Existing digital tools | Demiplane Nexus (official character tools); Roll20 support; cyberpunkred.com companion app |
| Digital tool gaps | No dedicated session/campaign manager |
| QuiverDM relevance | Moderate — similar session-note and NPC-tracking needs; video game audience may drive platform awareness |

**Technical complexity: Medium**

Cyberpunk Red uses the Interlock system (d10 + stat + skill vs. difficulty). It has:
- Role abilities (unique per character archetype — Netrunner, Rockerboy, etc.)
- Combat with hit locations and cyberware integration
- No CR/encounter budget system — GMs build scenes narratively

**Implementation work:** New character schema (Role abilities, cyberware, Humanity/Empathy mechanic). Session and NPC tools work as-is.

---

### 2.6 Blades in the Dark / Forged in the Dark / PbtA

| Attribute | Detail |
|---|---|
| Player base | #9 on StartPlaying as "PbtA RPG" category; Blades is top individual game in the family |
| Existing digital tools | Minimal official support. Itch.io community tools. No major VTT integration. |
| Digital tool gaps | Significant. No digital campaign manager exists for BitD/FitD. The audience tends to be tech-savvy early adopters. |
| QuiverDM relevance | High for session recaps and faction tracking (faction clocks are central to Blades). AI summaries would be novel. |

**Technical complexity: Low (system) / Medium (conceptual divergence)**

Blades in the Dark (FitD) and PbtA games:
- No stat blocks or encounter math at all
- PbtA: Roll 2d6 + stat modifier. 10+ = full success. 7–9 = success with complication. 6- = failure (often dramatic).
- FitD (Blades): Position + Effect dice pools; stress, trauma, and faction clocks
- **Key concept:** "Clocks" — pie-chart progress trackers for faction goals, project timelines, heist planning
- Sessions are structured around "scores" (jobs) with downtime between them

**Implementation work:**
- Clock tracker component (faction progress pies)
- Remove all D&D-specific encounter math
- Simplified character schema (no HP — stress/trauma instead)
- Move/Playbook system for PbtA character creation

**Key insight:** QuiverDM's transcription and AI summary features work entirely for this audience with zero changes. The system-specific features (clocks, playbooks) would be additive.

---

### 2.7 Other Notable Systems

#### Shadowrun (Catalyst Game Labs)
- **Player base:** Historically top-10; declining in 2024 due to publishing difficulties at Catalyst. The 6e edition was poorly received.
- **Digital tools:** Limited. Fan-made tools only. No major VTT integration.
- **Technical complexity:** Very High. Dual fantasy/cyberpunk ruleset. Matrix hacking runs parallel combat with different rules. Dice pools of up to 20+ d6s. Priority system character creation.
- **Recommendation:** Skip for initial expansion. Publisher instability and high technical cost are poor ROI.

#### Warhammer Fantasy Roleplay (Cubicle 7)
- **Player base:** Niche but very loyal (est. 200K–500K active players). Strong in Europe.
- **Digital tools:** Foundry VTT system (community-maintained); no major campaign manager.
- **Technical complexity:** Medium. d100 system (BRP-adjacent). Career system for advancement. Corruption/Wounds/Fate point mechanics.
- **Recommendation:** Consider if European market expansion is a priority. Low priority for US-first launch.

#### Starfinder (Paizo)
- **Player base:** Declining since Starfinder 2e announcement (still in playtest). Shares Pathfinder's system heritage.
- **Digital tools:** Foundry VTT; archives of Nethys SRD available.
- **Recommendation:** Wait for Starfinder 2e launch (2025–2026). Supporting PF2e likely covers ~80% of the technical work needed for Starfinder 2e.

#### Savage Worlds (Pinnacle Entertainment)
- **Player base:** Small but dedicated. Strong convention/one-shot presence.
- **Digital tools:** Foundry VTT system. Fantasy Grounds support.
- **Recommendation:** Low priority. Niche audience, well-served by existing tools.

#### GURPS (Steve Jackson Games)
- **Player base:** Very small active player base. Known more as a design reference than an actively played system.
- **Digital tools:** Minimal. GCS (GURPS Character Sheet) app.
- **Recommendation:** Skip. Audience is too small and system is extremely complex.

#### Daggerheart (Darrington Press / Critical Role)
- **Player base:** Launched 2024/2025; rapidly growing due to Critical Role's audience. Top anticipated TTRPG in EN World 2025 polls.
- **Digital tools:** Official Demiplane integration announced.
- **Technical complexity:** Medium. Uses 2d12 Hope/Fear dice system. No traditional CR.
- **Recommendation:** Monitor closely. If Critical Role continues to drive player growth, this could become top-5 by 2026.

---

## 3. Priority Recommendation

### Recommended Expansion Order (After D&D 5e)

#### Priority 1: Pathfinder 2e
**Why:**
- #2 globally, 12% market share, fastest-growing major system
- 1.5M+ new Remaster adopters in 6 months
- OGL refugee audience is tech-forward and actively looking for new tools
- Free, comprehensive SRD (Archives of Nethys) lowers data acquisition cost
- Foundry VTT is excellent for VTT play but has no session-management focus — clear gap for QuiverDM
- Shared d20 ancestry with D&D means the QuiverDM mental model transfers well for users

**Build effort:** 3–4 months (encounter calculator, stat block renderer, SRD import, condition tracker)

#### Priority 2: Call of Cthulhu
**Why:**
- Consistent top-5 globally, >10% of Roll20 games
- Horror/investigation genre is underserved by campaign management tools
- QuiverDM's transcription, NPC tracking, and AI summaries work out-of-the-box for CoC sessions
- No encounter math required — the most technically simple system on the list
- Investigation/clue tracking is a natural feature extension that would differentiate QuiverDM

**Build effort:** 1–2 months (character/NPC schema, SAN tracker, clue tracker). Transcription and AI features require no changes.

#### Priority 3: Vampire: The Masquerade 5e
**Why:**
- #3 on StartPlaying 2024 — larger active player base than most people expect
- Demiplane's nexus covers rulebook access; no one owns the session/campaign management space for V5
- Gothic horror / political intrigue narrative structure maps perfectly to QuiverDM's NPC and session features
- The Storyteller role is more narrative than tactical — exactly the workflow QuiverDM is built for
- d10 pool mechanics are simpler to model than PF2e's scaling math

**Build effort:** 2–3 months (character schema, Hunger/Humanity tracker, faction/coterie relationship tools)

---

### System-Agnostic Features (Benefit All Systems)

These QuiverDM features provide value regardless of game system and should be the foundation of any multi-system pitch:

| Feature | Value Across Systems |
|---|---|
| Session transcription (Whisper/AssemblyAI) | Every TTRPG has sessions. GMs universally struggle with notes. |
| AI session summaries | System-independent narrative recap. |
| NPC management | Every system has characters. Names, descriptions, and relationships are universal. |
| Homebrew PDF ingestion (Docling) | Every GM has PDFs — adventures, supplements, third-party modules. |
| Session recording storage | Universal utility. |
| Narrative search (embeddings) | "What happened with Lucius?" works for any system. |
| Campaign timeline / session log | Universal chronological structure. |
| Player portal (visibility controls) | Every GM wants to share some info with players, not all. |
| Encounter/scene planning notes | Even systems without encounter math have scene prep. |

**The pitch:** QuiverDM is already ~70% system-agnostic. The system-specific modules (encounter calculator, stat blocks, character sheets) are the remaining 30%. Adding a new system is primarily a UI/schema update, not an architecture rebuild.

---

## 4. Market Opportunity

### Total Addressable Market Expansion

| Scenario | Players Served | Notes |
|---|---|---|
| D&D 5e only (current) | ~20–25M | Dominant but single-system |
| + D&D 2024 | +0 net new | Same audience, backward-compatible |
| + Pathfinder 2e | +3–4M | 12% market share, dedicated base |
| + Call of Cthulhu | +2–3M | Horror niche, underserved digitally |
| + Vampire: The Masquerade | +1–2M | Gothic/horror, strong engagement |
| Total after top 3 expansions | ~27–34M | ~35–40% increase in TAM |

If QuiverDM targets all three additional systems, the total serviceable audience grows from ~25M to ~34M — roughly a **35% TAM expansion** with systems that are architecturally compatible with existing infrastructure.

### Risk: Fragmenting Focus Too Early

**The risk is real.** Each new system requires:
- Schema changes (breaking changes to existing models)
- UI variations (different stat blocks, different "encounter builder" or absence of one)
- Content data (SRD imports, monster databases)
- Testing burden across all supported systems
- Support surface area — GMs will report bugs specific to their system

**Recommended mitigation:**
1. **Phase the expansion.** Do not announce multi-system support at beta launch. Establish D&D 5e product-market fit first.
2. **Build the abstraction layer first.** Before adding PF2e, refactor QuiverDM's data models to be system-parameterized rather than D&D-hardcoded. This is the high-ROI investment.
3. **CoC first as a test case.** Call of Cthulhu requires the least technical work — use it as a proof of concept for "system support" before tackling PF2e's encounter math.
4. **Daggerheart wildcard.** If Critical Role drives Daggerheart to top-5 by mid-2026, it should jump the queue ahead of V5.

### Competitive Moat

The main competitors in campaign management are:
- **World Anvil** — wiki-style, system-agnostic, no transcription/AI
- **LoreKeeper.ai** — system-agnostic, AI-powered, early stage
- **Archivist** — session transcription and notes, D&D-centric
- **Obsidian RPG Manager plugin** — system-agnostic but requires technical setup

QuiverDM's differentiated features — live session transcription, AI summaries, narrative search via embeddings, and webhook integrations — are meaningful advantages across all systems. No competitor currently offers this combination for PF2e, CoC, or V5.

---

## 5. Summary Recommendation

| Priority | System | TAM Gain | Tech Effort | Time |
|---|---|---|---|---|
| 0 | D&D 2024 | Incremental | Minimal | 2–4 weeks |
| 1 | Pathfinder 2e | ~3–4M players | Medium-High | 3–4 months |
| 2 | Call of Cthulhu | ~2–3M players | Low | 1–2 months |
| 3 | Vampire: The Masquerade 5e | ~1–2M players | Low-Medium | 2–3 months |
| 4 (watch) | Daggerheart | Unknown, growing fast | Medium | TBD |
| Skip | Shadowrun, GURPS | Small/declining | Very High | — |

**The single most important technical investment before any system expansion:** Refactor data models to be system-parameterized. The current architecture has D&D 5e baked in (CR values, spell slots, ability scores). Abstracting the "system schema" layer — even partially — will make every subsequent system addition dramatically cheaper.

---

## Sources

- [StartPlaying Games: Most Popular TTRPGs in 2024](https://startplaying.games/blog/posts/the-most-popular-ttrpgs-on-startplaying-games-in-2024)
- [RPGDrop: Worldwide TTRPG Market in 2024 – Industry Analysis](https://www.rpgdrop.com/worldwide-ttrpg-market-in-2024-industry-analysis/)
- [industryresearch.biz: TTRPG Market Size & Share, CAGR 11.88%](https://www.industryresearch.biz/market-reports/tabletop-role-playing-game-ttrpg-market-105312)
- [Pathfinder 2e on Foundry VTT (official partnership)](https://foundryvtt.com/packages/pf2e)
- [Best VTTs for Pathfinder 2e – StartPlaying](https://startplaying.games/blog/posts/which-vtt-best-pathfinder-2e)
- [Demiplane: Vampire: The Masquerade NEXUS launch](https://www.demiplane.com/blog/demiplane-launches-full-access-for-the-vampire-the-masquerade-nexus)
- [Vampire: The Masquerade on Alchemy VTT (2024)](https://www.paradoxinteractive.com/games/world-of-darkness/news/alchemy)
- [Roll20: Call of Cthulhu hub (1-in-10 games statistic)](https://pages.roll20.net/call-of-cthulhu)
- [EN World: ICv2 Quarterly Chart – D&D Top, PF2 Strong](https://www.enworld.org/threads/icv2s-latest-quarterly-chart-d-d-top-but-pf2-is-strong.669434/)
- [The 15 Biggest Differences Between Pathfinder 2e and D&D 5e – CBR](https://www.cbr.com/pathfinder-vs-dnd-5e/)
- [Encounter Building in Pathfinder vs D&D – The Finished Book](https://tomedunn.github.io/the-finished-book/theory/xp-dnd-vs-pathfinder/)
- [How CoC differs from D&D – Quora](https://www.quora.com/How-does-Call-of-Cthulhu-work-and-how-is-it-different-from-standard-D-D-on-a-game-mechanics-and-game-mechanics-level)
- [Vampire V5 Beginner's Guide – Gafarov Productions](https://www.gafarovproductions.com/post/beginners-guide-vampire-the-masquerade)
- [D&D 2024 FAQ – D&D Beyond](https://www.dndbeyond.com/posts/1310-faq-one-d-d-2024-core-rulebooks-d-d-digital-and)
- [Cyberpunk RED Nexus – Demiplane](https://app.demiplane.com/nexus/cyberpunkred)
- [TTRPG Campaign Management Software – RPG Pub](https://www.rpgpub.com/threads/rpg-campaign-management-software-methods-2024-edition.11337/)
- [RPG Sales of 2024 – EN World](https://www.enworld.org/threads/rpg-sales-of-2024.701940/)
- [Global TTRPG Market Size 2025–2035 – Global Growth Insights](https://www.globalgrowthinsights.com/market-reports/tabletop-role-playing-game-ttrpg-market-103239)
