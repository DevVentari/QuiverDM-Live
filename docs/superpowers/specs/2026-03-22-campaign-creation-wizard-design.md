# Campaign Creation Wizard Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the sprawling campaign creation form with a focused 4-step wizard that supports published D&D Beyond adventures and party import at creation time.

**Architecture:** Client-side wizard with static adventure metadata, existing tRPC procedures for create/import/seed. No new backend procedures required.

**Tech Stack:** Next.js 15 App Router, tRPC v11, shadcn/ui, Tailwind, Lucide icons

---

## Problem Statement

The current `/campaigns/new` page is a single long form with ~15 sections including player entry rows (dead in DM-only direction), advanced scheduling/logistics fields (enterprise-y, out of place), and no path for published adventures. It doesn't reflect the DM-first, world-alive philosophy of QuiverDM.

## Design Decisions

- **Wizard over form:** 4 steps, clear progress, focused attention at each stage
- **Published adventure as first-class path:** Select adventure → fields pre-fill
- **Party import at creation:** DnD Beyond URL → characters imported immediately, not as a post-creation afterthought
- **Remove dead fields:** Manual player entry rows, schedule/house-rules/game-system advanced settings, document import at creation time
- **No new backend:** `campaigns.create`, `charactersDndBeyond.importFromCampaign`, `brain.seedFromCreation` all exist and are reused

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/adventure-templates.ts` | Create | Static metadata for 16 published adventures |
| `src/app/(app)/campaigns/new/page.tsx` | Rewrite | 4-step wizard orchestrator |
| `src/components/create/adventure-picker.tsx` | Create | Searchable grid of adventure cards for Step 1 |
| `src/components/create/party-import-step.tsx` | Create | D&D Beyond party import UI for Step 2 |
| `src/components/create/create-page-shell.tsx` | Keep | Layout shell — no changes needed |

---

## Adventure Templates (`src/lib/adventure-templates.ts`)

**Field length constraints (from `brain.seedFromCreation` Zod schema):**
- `openingHook`: max 200 characters — all template values must be ≤200 chars
- `antagonistMotivation`: max 200 characters — all template values must be ≤200 chars
- `factions`: max 3 entries — each template is capped at 3 factions

```ts
export interface AdventureTemplate {
  id: string;
  title: string;
  levelRange: string;
  setting: string;
  startingLocation: string;
  antagonistName: string;
  antagonistMotivation: string; // max 200 chars
  openingHook: string; // max 200 chars
  description: string;
  factions: Array<{ name: string; stance: 'ally' | 'neutral' | 'hostile' }>;
  tags: string[];
  gradient: string; // Tailwind gradient classes for card visual
}
```

**The 16 adventures (in full):**

1. **Waterdeep: Dragon Heist** — id: `wdh` — levels 1–5 — tags: city, intrigue, heist
   - Setting: Forgotten Realms
   - Starting location: Waterdeep, the City of Splendors
   - Antagonist: Xanathar (Beholder crime lord of the Xanathar's Guild)
   - Motivation: Seize the Cache of Dragons and destroy rival factions
   - Opening hook: A brawl at the Yawning Portal pulls the party into a citywide conspiracy over half a million gold dragons
   - Description: A half-million gold dragons are hidden in Waterdeep. Faction war erupts over the prize.
   - Factions: Harpers (ally), Zhentarim (neutral), Xanathar's Guild (hostile) ← capped at 3

2. **Icewind Dale: Rime of the Frostmaiden** — id: `idrotf` — levels 1–12 — tags: horror, wilderness, survival
   - Setting: Forgotten Realms
   - Starting location: Ten-Towns, Icewind Dale
   - Antagonist: Auril the Frostmaiden (goddess of winter)
   - Motivation: Shroud the world in eternal winter and be worshipped as the sole surviving deity
   - Opening hook: Auril has blotted out the sun over Icewind Dale — Ten-Towns slowly freezes as the party arrives
   - Description: The goddess Auril plunges Icewind Dale into eternal winter. The party must end her reign before the last town falls.
   - Factions: Arcane Brotherhood (hostile), Reghed Nomads (neutral), Dwarves of Kelvin's Cairn (ally)

3. **Vecna: Eve of Ruin** — id: `veor` — levels 10–20 — tags: multiplanar, epic, horror
   - Setting: Multiplanar (Sigil and beyond)
   - Starting location: Sigil, the City of Doors
   - Antagonist: Vecna, the Undying King
   - Motivation: Unmake the multiverse and remake it in his image
   - Opening hook: The Lady of Pain summons the party to Sigil — Vecna has assembled the Rod of Seven Parts and the multiverse is fracturing
   - Description: Vecna is on the verge of godhood and plans to unmake reality. The party must stop him across the planes.
   - Factions: The Fraternity of Order (neutral), Harmonium (neutral), Athar (ally)

4. **Lost Mine of Phandelver** — id: `lmop` — levels 1–5 — tags: dungeon-crawl, starter, classic
   - Setting: Forgotten Realms
   - Starting location: Phandalin, a frontier town near Neverwinter
   - Antagonist: Nezznar the Black Spider (drow mage)
   - Motivation: Claim the magical forge of spells in Wave Echo Cave for personal power
   - Opening hook: A supply run to Phandalin goes wrong — the dwarven employers are missing and goblins have ambushed the road
   - Description: A classic starter adventure. Find the lost mine, save the town, and face the Black Spider.
   - Factions: Harpers (ally), Lords' Alliance (neutral), Redbrand Ruffians (hostile)

5. **Curse of Strahd** — id: `cos` — levels 1–10 — tags: horror, gothic, sandbox
   - Setting: Barovia (Ravenloft)
   - Starting location: Barovia Village, the realm of Barovia
   - Antagonist: Strahd von Zarovich (vampire lord)
   - Motivation: Possess Ireena Kolyana, the reincarnation of his lost love Tatyana
   - Opening hook: The party is lured into the mist-shrouded realm of Barovia — escape is impossible until Strahd is destroyed
   - Description: Trapped in the gothic realm of Barovia, the party must destroy the vampire lord Strahd or be enslaved forever.
   - Factions: Vistani (neutral), Order of the Silver Dragon (ally), Village of Barovia (neutral)

6. **Descent into Avernus** — id: `dia` — levels 1–13 — tags: hellscape, war, epic
   - Setting: Forgotten Realms / Avernus (Nine Hells)
   - Starting location: Baldur's Gate
   - Antagonist: Zariel (Fallen Angel, Archduke of Avernus)
   - Motivation: Wage eternal war in Avernus and drag Elturel into Hell as a trophy
   - Opening hook: The city of Elturel vanishes into the Nine Hells — the party must follow it into Avernus to bring it back
   - Description: Follow Elturel into the Nine Hells, survive Avernus, and stop the fallen angel Zariel's war machine.
   - Factions: Flaming Fist (neutral), Hellriders (ally), Cult of Zariel (hostile)

7. **Tomb of Annihilation** — id: `toa` — levels 1–11 — tags: jungle, death-curse, exploration
   - Setting: Chult (Forgotten Realms)
   - Starting location: Port Nyanzaru, Chult
   - Antagonist: Acererak the Demilich
   - Motivation: Feed souls to the Soulmonger to fuel his undead apotheosis
   - Opening hook: A death curse is killing all who have ever been resurrected — the source is somewhere deep in the jungles of Chult
   - Description: A death curse is undoing all resurrections. Race through the jungles of Chult to destroy the Soulmonger.
   - Factions: Merchant Princes of Port Nyanzaru (neutral), Flaming Fist (neutral), Undead (hostile)

8. **Wild Beyond the Witchlight** — id: `wbtw` — levels 1–8 — tags: feywild, whimsy, mystery
   - Setting: The Feywild
   - Starting location: The Witchlight Carnival
   - Antagonist: The Hourglass Coven (three hags: Bavlorna, Skabatha, Endelyn)
   - Motivation: Each hag hoards stolen dreams and refuses to return what the party seeks
   - Opening hook: The Witchlight Carnival has returned — the party senses something was stolen from them long ago and follows it into the Feywild
   - Description: Something was stolen from you as a child. Follow the Witchlight Carnival into the Feywild to reclaim it.
   - Factions: Zybilna's Court (neutral), Korreds (ally), Hourglass Coven (hostile)

9. **Storm King's Thunder** — id: `skt` — levels 1–11 — tags: giants, open-world, epic
   - Setting: Forgotten Realms (Sword Coast + North)
   - Starting location: Nightstone, a small town near Waterdeep
   - Antagonist: Iymrith the Ancient Blue Dragon (manipulating giant lords)
   - Motivation: Sow chaos among the giant lords to prevent any one giant king from rising to power
   - Opening hook: Giants are attacking settlements across the North — the ordning (giant hierarchy) has shattered and no one knows why
   - Description: Giants rampage across the Sword Coast. Unravel the conspiracy behind the shattered ordning before civilization falls.
   - Factions: Lords' Alliance (ally), Harpers (ally), Giant Lords (hostile)

10. **Out of the Abyss** — id: `oota` — levels 1–15 — tags: underdark, survival, demon-lords
    - Setting: The Underdark
    - Starting location: Velkenvelve, a drow outpost deep in the Underdark
    - Antagonist: Demon Lords (Demogorgon, Orcus, Zuggtmoy, others)
    - Motivation: The demon lords have been summoned into the Underdark and spread madness through its depths
    - Opening hook: The party wakes in chains in a drow prison — they must escape the Underdark before demon lords consume it
    - Description: Escape from drow captivity in the Underdark while demon lords tear it apart around you.
    - Factions: Drow of House Baenre (hostile), Emerald Enclave (ally), Gnomes of Blingdenstone (ally)

11. **Princes of the Apocalypse** — id: `pota` — levels 1–15 — tags: elemental, dungeon-crawl, open-world
    - Setting: Forgotten Realms (Dessarin Valley)
    - Starting location: Red Larch, Dessarin Valley
    - Antagonist: The Elder Elemental Eye (four elemental cults)
    - Motivation: Free the elder elemental princes and remake the world in primal chaos
    - Opening hook: Strange things are happening in the Dessarin Valley — missing delegations, weird weather, and cults spreading through the countryside
    - Description: Four elemental cults seek to unleash catastrophic power on the Sword Coast. Stop them before the prophets summon their gods.
    - Factions: Harpers (ally), Emerald Enclave (ally), Crushing Wave (hostile) ← capped at 3

12. **Hoard of the Dragon Queen** — id: `hotdq` — levels 1–8 — tags: dragons, tyranny, epic
    - Setting: Forgotten Realms (Sword Coast)
    - Starting location: Greenest, a town under dragon attack
    - Antagonist: Severin Silrajin (Wyrmspeaker, servant of Tiamat)
    - Motivation: Collect the Dragon Hoard to fund Tiamat's return from the Nine Hells
    - Opening hook: A blue dragon and the Cult of the Dragon attack Greenest — the party arrives as the town burns
    - Description: The Cult of the Dragon is assembling a hoard to free Tiamat. Stop them before the Dragon Queen returns.
    - Factions: Harpers (ally), Lords' Alliance (ally), Cult of the Dragon (hostile)

13. **Ghosts of Saltmarsh** — id: `gos` — levels 1–12 — tags: nautical, investigation, anthology
    - Setting: Greyhawk (Saltmarsh)
    - Starting location: Saltmarsh, a fishing town on the Azure Sea
    - Antagonist: The Scarlet Brotherhood (spy network + sahuagin threat)
    - Motivation: Destabilize Saltmarsh's trade routes and gain control of the Azure Sea
    - Opening hook: A haunted mansion on the cliffs above Saltmarsh hides something far more dangerous than ghosts
    - Description: Saltmarsh faces threats from land and sea — smugglers, sea creatures, and a spy network conspiring against the town.
    - Factions: Saltmarsh Council (ally), Scarlet Brotherhood (hostile), Sahuagin (hostile)

14. **Keys from the Golden Vault** — id: `kftgv` — levels 1–11 — tags: heist, anthology, one-shots
    - Setting: Various (anthology)
    - Starting location: The Golden Vault (mysterious benefactor)
    - Antagonist: Varies per mission
    - Motivation: The Golden Vault sends the party on heist missions for unknown but ostensibly good reasons
    - Opening hook: A golden music box appears with a key inside — and instructions for a job that must go perfectly
    - Description: Thirteen heist missions from a mysterious benefactor. Steal, infiltrate, and outmaneuver in style.
    - Factions: The Golden Vault (ally), Targets vary (hostile)

15. **Spelljammer: Light of Xaryxis** — id: `lox` — levels 5–8 — tags: spelljammer, space, action
    - Setting: Wildspace / Astral Sea
    - Starting location: A port city attacked from space
    - Antagonist: Xaryxispace Astral Elves (Emperor Xeleth)
    - Motivation: Drain the life force of entire worlds to power their dying sun
    - Opening hook: Astral elves descend from the sky and drain the life from the earth — the party must take the fight to space
    - Description: Chase astral elves across the cosmos to stop them from killing your home world.
    - Factions: Giff (ally), Rock Gnomes (ally), Xaryxian Empire (hostile)

16. **Phandelver and Below: The Shattered Obelisk** — id: `tso` — levels 1–12 — tags: psionic, illithid, horror
    - Setting: Forgotten Realms (Phandalin region)
    - Starting location: Phandalin
    - Antagonist: Ilvaash the Godlet (Far Realm entity)
    - Motivation: Shatter an ancient obelisk to open a portal to the Far Realm and transform all life into mind flayers
    - Opening hook: Phandalin is under attack by mind flayers — and something in the Far Realm is pulling the strings
    - Description: A Far Realm horror threatens Phandalin and all life beyond it. Stop the mind flayer cult before the portal opens.
    - Factions: Harpers (ally), Emerald Enclave (ally), Cult of Ilvaash (hostile)

---

## Wizard Steps

### Step 1: Choose Path

Two large cards side by side:
- **Published Adventure** — Book icon, subtitle "Choose from 16 official 5e adventures"
- **Original Campaign** — Scroll icon, subtitle "Build your own world from scratch"

Selecting "Published Adventure" expands an `<AdventurePicker>` grid below:
- Searchable by title
- Filterable by tag pills (All / City / Horror / Dungeon / Wilderness / Heist / Multiplanar / Space)
- Each card: title, level range badge, 2-3 tag pills, themed gradient background
- Selected card gets amber border glow
- "Next →" enabled once a path is chosen (Published = adventure selected; Original = immediately enabled)

### Step 2: Party Import

Header: "Import your party from D&D Beyond"

**If CobaltSession configured (check via `userSettings.getSettings` — boolean field `hasDndBeyondCobaltCookie`):**
- URL input: "Paste your D&D Beyond campaign URL"
- "Validate" button → validates URL format client-side and stores in wizard state. The actual import (`charactersDndBeyond.importFromCampaign`) runs **after campaign creation** in Step 4's `handleCreate()`. URL format validation by the existing endpoint — show inline error on failure.
- Shows a "Party will be imported on creation" confirmation chip once URL is set

**If no CobaltSession:**
- Amber callout: "Add your Cobalt token in Settings → API Keys to enable D&D Beyond party import"
- Link to settings

Always: "Skip for now →" link at bottom. Step is fully optional.

Note: `importFromCampaign` needs a `campaignId` — but the campaign hasn't been created yet at Step 2. **Solution:** Store the DnD Beyond campaign URL in state, run the import *after* campaign creation in `handleCreate()`, same as how onboarding does it.

### Step 3: World Setup

Pre-filled from selected adventure template (all fields editable). Blank for Original Campaign.

Sections:
1. **Identity** — Campaign name (required), description (textarea)
2. **Banner** — Drag/drop or click upload (same as current)
3. **World** — Starting location, Antagonist name, Antagonist motivation, Opening hook
4. **Factions** — Pre-populated rows from template, add/remove, stance select (ally/neutral/hostile)
5. **Story So Far** — Blank textarea (adventure DMs may want to note where in the adventure they're starting)

### Step 4: Confirm & Create

Summary card:
- Adventure title (or "Original Campaign")
- Party: "X characters imported" or "No party imported yet"
- World: starting location + antagonist if set
- "Create Campaign" primary CTA

On submit:
1. `campaigns.create({ name, description, bannerUrl })` → get `campaign.id` and `slug`
   - Only these 3 fields go to `campaigns.create`. World setup fields do NOT go here.
2. If DnD Beyond URL stored → fire-and-forget `charactersDndBeyond.importFromCampaign({ campaignUrl: ddbCampaignUrl, campaignId: campaign.id })`
3. If any world data (startingLocation || antagonistName || openingHook || storyText || factions.length) → fire-and-forget `brain.seedFromCreation({ campaignId: campaign.id, worldSetup: { startingLocation, antagonistName, antagonistMotivation, openingHook, factions }, storyText })`
4. `router.push(\`/campaigns/${campaign.slug}\`)`

---

## Component Specs

### `AdventurePicker` (`src/components/create/adventure-picker.tsx`)

Props: `value: AdventureTemplate | null`, `onChange: (a: AdventureTemplate) => void`

- Search input (filters by title)
- Tag filter pills (All, City, Horror, Dungeon, Wilderness, Heist, Multiplanar, Space)
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`
- Each card: `h-24` gradient div, title overlay, level range + tags below
- Selected: amber ring + glow (`ring-2 ring-amber-500/60`)

### `PartyImportStep` (`src/components/create/party-import-step.tsx`)

Props: `campaignUrl: string`, `onChange: (url: string) => void`, `hasCobalt: boolean`

- Controlled URL input
- Import state: idle / importing / done (shows character chips) / error
- Since import happens post-creation, this component is display-only at runtime — it captures the URL and signals back to parent

### Wizard orchestrator (`src/app/(app)/campaigns/new/page.tsx`)

State:
```ts
const [step, setStep] = useState<1|2|3|4>(1);
const [path, setPath] = useState<'published'|'original'|null>(null);
const [selectedAdventure, setSelectedAdventure] = useState<AdventureTemplate|null>(null);
const [ddbCampaignUrl, setDdbCampaignUrl] = useState('');
// Step 3 fields (pre-filled from adventure or blank):
const [name, setName] = useState('');
const [description, setDescription] = useState('');
const [bannerUrl, setBannerUrl] = useState<string|null>(null);
const [startingLocation, setStartingLocation] = useState('');
const [antagonistName, setAntagonistName] = useState('');
const [antagonistMotivation, setAntagonistMotivation] = useState('');
const [openingHook, setOpeningHook] = useState('');
const [factions, setFactions] = useState<Faction[]>([]);
const [storyText, setStoryText] = useState('');
```

When `selectedAdventure` changes, pre-fill Step 3 fields from template.

**Step indicator:** 4 dots or numbered steps, amber for active/complete, muted for pending. Similar pattern to onboarding wizard.

---

## What Gets Removed

From `src/app/(app)/campaigns/new/page.tsx`:
- Manual player entry rows `{ name: string; characterName: string }[]`
- `showAdvanced` accordion and all advanced fields: `gameSystem`, `settingName`, `playerCount`, `startingLevel`, `scheduleDay`, `scheduleTime`, `scheduleFrequency`, `houseRules`
- Document import section (`docFiles`, `getUploadUrl`, `createPDF`)
- `themes` / tone section (can be added to Campaign Settings later)

---

## Testing

- `tests/workflows/campaign-create.spec.ts` exists — update to reflect new wizard flow
- Verify Step 1 path selection renders adventure picker
- Verify adventure selection pre-fills Step 3 fields
- Verify Original Campaign path shows blank Step 3 fields
- Verify Skip on Step 2 advances to Step 3 without error
- Verify successful creation redirects to campaign overview
