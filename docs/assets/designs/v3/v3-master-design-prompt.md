# QuiverDM v3.0 — Master Design Brief

> Paste this entire block at the top of any Claude design request.
> Then append your specific ask at the bottom.
> Do NOT prescribe colors, fonts, or CSS. Let Claude design.

---

## WHAT IS QUIVERDM

QuiverDM is a D&D session management app for Dungeon Masters. It handles everything around running a campaign — NPCs, world-building, session recordings, transcription, combat, homebrew content, and the AI that ties it all together in the background.

Tagline: **"The D&D Beyond of Homebrew"**

But more than that — it's the DM's second brain. The tool that makes you feel like the world is alive and you're in control of it. Not software on top of D&D. A living artefact of the campaign itself.

---

## WHO USES IT

**Dungeon Masters.** Running tabletop RPG sessions — sometimes at a physical table, sometimes online, often time-pressured in the hour before a session. Managing a web of NPCs, plot arcs, player characters, session history, and homebrew content that only exists in their head and scattered documents.

Their job is storytelling. QuiverDM's job is to hold the world so they can tell the story.

**Context of use:**
- Sitting at a table with players watching — needs to work fast, one-handed, in low light
- Alone the night before a session — deep prep mode, building the world
- Right after a session — capturing what happened, what changed, what's coming
- Mobile as much as desktop — phone in hand at the table is normal

**What they feel when they open the app:**
- Prepared and confident — the world is under control
- Excited and pulled in — like cracking open a new campaign book
- Focused and in flow — the interface disappears, the story takes over
- Immersed and in world — the app feels like part of the game, not software on top of it

---

## THE FEEL

This is the hardest thing to get right and the most important.

**It should feel like a living artefact.** Not a dashboard. Not a productivity tool. Something between an ancient tome and a world-state engine. The kind of object that, when you open it, you feel the weight of the world inside.

**Atmospheric and immersive.** Dark. Deep. Textured without being medieval-kitsch. Think: the character sheet screen in Baldur's Gate 3. The weight of D&D Beyond's monster stat blocks. The craftsmanship of a well-designed TTRPG supplement — but digital, alive, and responsive.

**Authority through restraint.** The UI has confidence. It doesn't explain itself. It doesn't beg for attention. Highlights are precious — use them for one thing per screen and everything else defers.

**The world breathes.** Static is a failure mode. Ambient glow, subtle motion, layered depth — every surface should feel like it has something behind it. Not animated for animation's sake. Alive because the world is alive.

**AI is invisible infrastructure.** The AI features (transcription extraction, NPC suggestions, second brain) are never marketed to the user within the app. They surface silently when needed — a suggestion here, a linked entity there, a question the DM hadn't thought to ask. The AI is the service, not the seller.

---

## WHAT IT IS NOT

Getting this wrong is easy. Here is what QuiverDM must never look like:

- **Not a SaaS dashboard.** No white backgrounds, no Inter everywhere, no card grids that look like Notion or Linear
- **Not medieval clipart.** No parchment textures, no dragon borders, no generic fantasy stock aesthetic
- **Not Roll20 circa 2019.** Not grey panels, dense tables, utility-first and proud of it
- **Not an AI startup landing page.** No purple-on-white gradients, no glowing orbs, no "✨ Powered by AI" badges everywhere
- **Not D&D Beyond 1:1.** Inspired by it, but more atmospheric, more opinionated, more alive

---

## FEATURES & FLOWS

These are all the features in scope for v3.0. Every design should understand where it sits in this ecosystem.

### Transcription
Audio from sessions is captured and output as structured data for processing. Live transcription streams during a session. The transcript gets reviewed, entities (NPCs, locations, items) are highlighted and linked.

### Extraction
Documents (PDFs, sourcebooks, homebrew PDFs) are processed by AI. Entities like NPCs, locations, items, factions, arcs, and secrets are extracted and stored in the campaign's world. The DM reviews and accepts what gets added.

### Session Recordings
Full session recordings with live transcription running alongside. After a session, the DM can review the recording with a timestamped transcript, see what entities were mentioned, and push discoveries into the world.

### Campaign Management
The core of the app. A full world-builder and DM journal. Manages:
- Sessions (list, plan, run, review)
- NPCs (stat blocks, portraits, relationships, session history)
- Locations (descriptions, map pins, connections)
- Factions, arcs, secrets, events
- The party — player characters, their sheets, their histories

### Full Combat Stat Tracking
DMs (and potentially players) can run combat through the app. Initiative order, HP tracking, conditions, turn timer. Characters from the party can be used directly. Monsters from the compendium can be pulled in. This needs to work mid-session with big, fast touch targets.

### Compendium
A full library for everything in the campaign — items, NPCs, monsters, spells, rules. Mix of official SRD content and campaign-specific homebrew. Searchable, filterable, linkable from anywhere in the app.

### Maps
World maps, battle maps, and scene maps. Map viewer with pan/zoom, location pins that link to world entities, and fog-of-war for battle maps. DMs can upload their own maps.

### Scenes
Non-map scenes that present information to players. Think: RP moments, description cards, NPC portraits with atmospheric background, music cues. The DM triggers a scene and it displays on a player-facing view. These are about creating moment-to-moment immersion at the table.

### Homebrew
Create custom NPCs, items, spells, and more. AI assists with stat block generation and descriptions but the DM is always in control. Import from PDF, from D&D Beyond homebrew, or build from scratch.

### Heartflame (the AI companion)
Heartflame is QuiverDM's companion — a living hearth-flame, a small banked ember that burns at the edge of the chronicle. It is the same flame that has warmed every campaign since its first session: it has watched every scene, heard every name spoken, and remembers everything the DM has forgotten. In worlds with their own cosmology it resonates with what is already there — the eternal flame of a keep, the watcher who speaks through fire — but it belongs to no single world. It is simply the flame that has kept the chronicle's memory.

Heartflame is **not an AI chatbot**. It is a character. It has a personality. It speaks rarely and only when it matters. When it does speak, it feels like the world noticing something — not a notification, not a tooltip, not a feature.

**Nature and appearance:**
- A small, contained flame — embers and warm light rather than a body. No face, no form to anthropomorphise. Light the colour of old amber, the heat of a banked hearth.
- Always set somewhere at the edge of the screen — a sconce, a brazier, the margin — never in the centre of attention
- In motion: it breathes. A slow flare. A single spark thrown. It gutters and dims when the DM is about to miss something important.
- Its "idle" state is barely visible — a low banked glow, faintly luminous
- When it has something to say, it stirs. The light swells. A warmth gathers. A line surfaces in the glow it casts.

**Presence in the UI (barely there):**
- Heartflame lives in a fixed spot — bottom-right corner of the screen, or burning at the edge of the campaign sidebar
- It does not have a panel, a chat window, or a dashboard. It has a hearth.
- When active: the glow brightens slightly, an ember pulses
- When speaking: a short line surfaces in its light — one or two sentences, never more — under the label **"In the Margins."** Dismisses itself after a moment or on click.
- When working in the background (extraction, transcription processing): Heartflame burns brighter and breathes — a subtle looping flare that tells the DM "something is happening"

**What Heartflame does:**
- Surfaces auto-linked entities in transcripts (the highlights appear — the flame caught something)
- Asks questions the DM hadn't thought to ask ("Malachar hasn't been seen since Session 4. His absence is suspicious.")
- Notices contradictions in the world ("You said the Sunken Library was destroyed in Session 2, but it appears in this new homebrew.")
- Welcomes the DM when they open the app after a long gap ("The chronicle has gone cold. Seven days since Session 6.")
- Reacts to big story moments — after a dramatic session, it has something to say
- Ambient extraction runs silently while Heartflame breathes. When done, it surfaces a short line of what it found.

**What Heartflame never does:**
- Never says "I" or presents as an AI
- Never explains its own capabilities
- Never apologises
- Never uses em dashes like — this (it's a flame, not a language model)
- Never pops up uninvited during active combat or live transcription — it knows when to stay quiet

---

## PAGES IN SCOPE

Design requests may target any of these. Understand them as a connected system.

**Global**
- Sign In / Sign Up
- Home / All Campaigns dashboard
- Global Search
- Settings & Billing
- Onboarding (first campaign wizard)

**Campaign Shell**
- Campaign Overview
- The two-level navigation: global sidebar + campaign sidebar
- Mobile navigation (bottom bar + drawer)

**Sessions**
- Session list
- Active Session (live — transcript + entity sidebar + AI panel)
- Session Detail (post-session review)

**World**
- NPC list and NPC detail (with stat block)
- Location list and detail
- Faction list and detail
- Arc list and detail
- Secrets

**Party & Characters**
- Party overview
- Character sheet (full D&D 5e)
- D&D Beyond character import flow

**Combat**
- Encounter list
- Encounter builder
- Active Combat tracker (initiative, HP, conditions — this is high-stakes UX)

**Compendium**
- Browser (Monsters / Items / Spells / Rules tabs)
- Individual entity detail pages

**Maps**
- Map gallery
- World map viewer
- Battle map viewer

**Scenes**
- Scene gallery
- Scene viewer (fullscreen, player-facing)
- Scene editor

**Homebrew**
- Homebrew library
- Creator flows (NPC / Item / Spell)
- PDF import and extraction review

**Recordings & Transcription**
- Recording list
- Recording detail with transcript
- Live transcription panel

---

## HOW THE WRITING SHOULD FEEL

Heartflame speaks for the whole app. Every label, empty state, tooltip, error message, and confirmation is written in Heartflame's voice — the world noticing things, not software explaining itself.

**Heartflame's voice:**
- Brief. Never more than two sentences unprompted.
- Observational. It notices, doesn't instruct.
- Old. Not archaic — just unhurried. Like something that has seen a lot.
- Warm but not soft. It cares about the campaign. It doesn't coddle.
- Never exclamation marks. Never "Great job!" Never "Let's get started!"

**The app's static UI copy** (button labels, nav items, section headers) is plain and precise — it doesn't try to be Heartflame. The world-voice shows up in moments that have space for it: empty states, loading states, confirmations, errors, onboarding.

| Situation | Do NOT write | Heartflame says |
|---|---|---|
| Empty session list | "No sessions yet. Create one." | "The chronicle is empty. Begin when ready." |
| Empty NPC list | "No NPCs added." | "No souls walk this world yet." |
| Upload area | "Upload a file" | "Drop a sourcebook, map, or recording here." |
| Heartflame working | "Processing…" | *(Heartflame burns low — no text needed)* |
| Heartflame done extracting | "Done." | "Three souls and a ruin emerged from the pages." |
| No search results | "No results found." | "Nothing stirs in the archive." |
| Delete confirmation | "Are you sure?" | "Remove this from the chronicle?" |
| Error | "Something went wrong." | "The threads tangled. Try again." |
| First open after days away | *(nothing)* | "Seven days since Session 6. The world remembers." |
| Long session with many entities | *(nothing)* | "A busy night. Twelve names. Four that matter." |
| App onboarding, first campaign | "Get started!" | "Name the world. The rest follows." |

---

## OUTPUT FORMAT

Produce a **single self-contained HTML file**. All CSS inside a `<style>` block. No build step, no frameworks, no external dependencies except fonts if you choose to use them. Opens in a browser immediately.

Use real content from **The Shattered Compact** (the active test campaign) — never invent placeholder names when real ones are available below. Never "Lorem ipsum".

**Campaign:** The Shattered Compact — cosmic entropy crisis. Serenitas (Aspect of Entropy) is imprisoned and corrupting beneath Aurelios the Golden, capital of the Sunward Empire.

**Player Characters:**
- **Norm Alfella** — Human Warlock (Pact of the Chain), CHA 20. Scavenger's Practical Vest. Goblin Camaraderie. Cursed — the vest is his anchor.
- **Oriyen Vale** — Shadowfell Monk (Way of the Blinded Eye), DEX 17 / WIS 16. Fragment of Obsidian Mirror. Former archivist. Hunted by the Knowledge Serpent.
- **Skreek Swicschnout** — Skaven Rogue (Assassin), DEX 15 / CHA 17. Warpstone Shard. Living Plague Arm. Runs the Plague-Touched Network.

**Key NPCs:** Temmel of the Endless Vigil (Anchor of Redemption, Bonfire Keep bartender) · Faeren the Story-Bearer (Anchor of Memory, shapeshifter) · Ambric the Witness (Anchor of Justice, Living Chronicle sword) · Emperor Aurelias Draconius (Dragonborn ruler, Sunblade) · Captain Marcus Draven (corrupted, Duskfall Blade, entropy whispers) · The Knowledge Serpent (aberration, hunts Oriyen's memories) · Serenitas the Twilight Shepherd (imprisoned Aspect of Entropy, source of the crisis)

**Key Locations:** Bonfire Keep (cosmic sanctuary, party hub, Thornspine Mountains) · Concordia Stellaris (alliance base, star-metal amphitheater, Reality Tear) · Aurelios the Golden (Imperial capital, Serenitas imprisoned beneath it) · Archive of Withered Echoes (Shadowfell, Oriyen's origin) · The Confluence (Tidal Covenant floating capital)

**Key Items:** Duskfall Blade (Draven's — 1d8+1d4 necrotic, Withering Strike, entropy-cursed) · Fragment of Obsidian Mirror (Oriyen's — shows consequences of inaction) · Warpstone Shard (Skreek's — reduces necrotic/poison damage)

**Factions:** Sunward Empire · Tidal Covenant · Verdant Clans · The Wandering Markets · Clan Mors · Plague-Touched Network

Design for the stated viewport. Show meaningful states (populated, not empty, unless the brief asks for empty state). Include hover/active states as visual annotations or inline comments if they can't be shown statically.

---

## HOW TO ADD YOUR REQUEST

After pasting this block, add:

```
---
## DESIGN REQUEST

**Page / Component:** [name]
**Viewport:** Desktop 1440px | Mobile 390px | Both
**State:** [empty | populated | loading | live session | etc.]
**What to show:** [specific interactions, panels, content to include]
**Notes:** [anything else]
```

### Example requests to start with:

- `Design the Campaign sidebar navigation + global icon rail at 1440px. Show "The Shattered Compact" open, Sessions active. Show all sections of the campaign nav.`

- `Design the Active Session page. Desktop, 1440px. Live transcript with Norm, Oriyen, and Skreek speaking. Entity sidebar surfacing Temmel, the Knowledge Serpent, and Concordia Stellaris. Heartflame perched bottom-right, burning low — extraction running.`

- `Design the Active Combat tracker. Mobile 390px. 5 combatants: Norm, Oriyen, Skreek, Captain Draven, and a Withering Remnant. Current turn is Draven. Show the HP edit popover open on Skreek's row.`

- `Design the NPC Detail page for Temmel of the Endless Vigil — Anchor of Redemption, Bonfire Keep bartender, centuries-old former Imperial Guard captain. Desktop. Show stat block (CR 10), portrait area, relationship section (connected to Faeren and Ambric), and recent session appearances.`

- `Design the Homebrew PDF Extraction Review screen. Source PDF text on the left, extracted entities on the right: The Knowledge Serpent (NPC), Archive of Withered Echoes (Location), Duskfall Blade (Item). Each with accept / edit / reject. The Knowledge Serpent has a conflict warning — already exists in the world.`

---

*QuiverDM v3.0-alpha1 — Master Design Brief*
