# Campaign Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sprawling `/campaigns/new` form with a focused 4-step wizard supporting published D&D adventure selection and D&D Beyond party import at creation time.

**Architecture:** Client-side wizard with static adventure metadata. Reuses existing `campaigns.create`, `brain.seedFromCreation`, and `charactersDndBeyond.importFromCampaign` tRPC procedures. No new backend required.

**Tech Stack:** Next.js 15 App Router, tRPC v11, shadcn/ui, Tailwind, Lucide icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/adventure-templates.ts` | Create | Static metadata for 16 published adventures |
| `src/components/create/adventure-picker.tsx` | Create | Searchable/filterable grid of adventure cards |
| `src/components/create/party-import-step.tsx` | Create | D&D Beyond campaign URL capture |
| `src/app/(app)/campaigns/new/page.tsx` | Rewrite | 4-step wizard orchestrator |
| `tests/workflows/campaign-create.spec.ts` | Rewrite | Wizard-aware E2E workflow tests |

---

### Task 1: Adventure templates data

**Files:**
- Create: `src/lib/adventure-templates.ts`

- [ ] **Step 1: Create the file with interface and all 16 adventure objects**

```ts
export interface AdventureTemplate {
  id: string;
  title: string;
  levelRange: string;
  setting: string;
  startingLocation: string;
  antagonistName: string;
  antagonistMotivation: string; // max 200 chars
  openingHook: string;          // max 200 chars
  description: string;
  factions: Array<{ name: string; stance: 'ally' | 'neutral' | 'hostile' }>;
  tags: string[];
  gradient: string; // Tailwind gradient classes
}

export const ADVENTURE_TEMPLATES: AdventureTemplate[] = [
  {
    id: 'wdh',
    title: 'Waterdeep: Dragon Heist',
    levelRange: '1–5',
    setting: 'Forgotten Realms',
    startingLocation: 'Waterdeep, the City of Splendors',
    antagonistName: 'Xanathar',
    antagonistMotivation: 'Seize the Cache of Dragons and destroy rival factions',
    openingHook: 'A brawl at the Yawning Portal pulls the party into a citywide conspiracy over half a million gold dragons',
    description: 'A half-million gold dragons are hidden in Waterdeep. Faction war erupts over the prize.',
    factions: [
      { name: 'Harpers', stance: 'ally' },
      { name: 'Zhentarim', stance: 'neutral' },
      { name: "Xanathar's Guild", stance: 'hostile' },
    ],
    tags: ['city', 'intrigue', 'heist'],
    gradient: 'from-purple-950 via-indigo-900 to-purple-950',
  },
  {
    id: 'idrotf',
    title: 'Icewind Dale: Rime of the Frostmaiden',
    levelRange: '1–12',
    setting: 'Forgotten Realms',
    startingLocation: 'Ten-Towns, Icewind Dale',
    antagonistName: 'Auril the Frostmaiden',
    antagonistMotivation: 'Shroud the world in eternal winter and be worshipped as the sole surviving deity',
    openingHook: "Auril has blotted out the sun over Icewind Dale — Ten-Towns slowly freezes as the party arrives",
    description: 'The goddess Auril plunges Icewind Dale into eternal winter. The party must end her reign before the last town falls.',
    factions: [
      { name: 'Arcane Brotherhood', stance: 'hostile' },
      { name: 'Reghed Nomads', stance: 'neutral' },
      { name: "Dwarves of Kelvin's Cairn", stance: 'ally' },
    ],
    tags: ['horror', 'wilderness', 'survival'],
    gradient: 'from-blue-950 via-slate-900 to-blue-950',
  },
  {
    id: 'veor',
    title: 'Vecna: Eve of Ruin',
    levelRange: '10–20',
    setting: 'Multiplanar (Sigil and beyond)',
    startingLocation: 'Sigil, the City of Doors',
    antagonistName: 'Vecna, the Undying King',
    antagonistMotivation: 'Unmake the multiverse and remake it in his image',
    openingHook: 'The Lady of Pain summons the party to Sigil — Vecna has assembled the Rod of Seven Parts and the multiverse is fracturing',
    description: 'Vecna is on the verge of godhood and plans to unmake reality. The party must stop him across the planes.',
    factions: [
      { name: 'Fraternity of Order', stance: 'neutral' },
      { name: 'Harmonium', stance: 'neutral' },
      { name: 'Athar', stance: 'ally' },
    ],
    tags: ['multiplanar', 'epic', 'horror'],
    gradient: 'from-violet-950 via-stone-900 to-violet-950',
  },
  {
    id: 'lmop',
    title: 'Lost Mine of Phandelver',
    levelRange: '1–5',
    setting: 'Forgotten Realms',
    startingLocation: 'Phandalin, a frontier town near Neverwinter',
    antagonistName: 'Nezznar the Black Spider',
    antagonistMotivation: 'Claim the magical forge of spells in Wave Echo Cave for personal power',
    openingHook: 'A supply run to Phandalin goes wrong — the dwarven employers are missing and goblins have ambushed the road',
    description: 'A classic starter adventure. Find the lost mine, save the town, and face the Black Spider.',
    factions: [
      { name: 'Harpers', stance: 'ally' },
      { name: "Lords' Alliance", stance: 'neutral' },
      { name: 'Redbrand Ruffians', stance: 'hostile' },
    ],
    tags: ['dungeon-crawl', 'starter', 'classic'],
    gradient: 'from-emerald-950 via-stone-900 to-emerald-950',
  },
  {
    id: 'cos',
    title: 'Curse of Strahd',
    levelRange: '1–10',
    setting: 'Barovia (Ravenloft)',
    startingLocation: 'Barovia Village, the realm of Barovia',
    antagonistName: 'Strahd von Zarovich',
    antagonistMotivation: 'Possess Ireena Kolyana, the reincarnation of his lost love Tatyana',
    openingHook: 'The party is lured into the mist-shrouded realm of Barovia — escape is impossible until Strahd is destroyed',
    description: 'Trapped in the gothic realm of Barovia, the party must destroy the vampire lord Strahd or be enslaved forever.',
    factions: [
      { name: 'Vistani', stance: 'neutral' },
      { name: 'Order of the Silver Dragon', stance: 'ally' },
      { name: 'Village of Barovia', stance: 'neutral' },
    ],
    tags: ['horror', 'gothic', 'sandbox'],
    gradient: 'from-red-950 via-stone-900 to-red-950',
  },
  {
    id: 'dia',
    title: 'Descent into Avernus',
    levelRange: '1–13',
    setting: 'Forgotten Realms / Avernus (Nine Hells)',
    startingLocation: "Baldur's Gate",
    antagonistName: 'Zariel',
    antagonistMotivation: 'Wage eternal war in Avernus and drag Elturel into Hell as a trophy',
    openingHook: "The city of Elturel vanishes into the Nine Hells — the party must follow it into Avernus to bring it back",
    description: "Follow Elturel into the Nine Hells, survive Avernus, and stop the fallen angel Zariel's war machine.",
    factions: [
      { name: 'Flaming Fist', stance: 'neutral' },
      { name: 'Hellriders', stance: 'ally' },
      { name: 'Cult of Zariel', stance: 'hostile' },
    ],
    tags: ['hellscape', 'war', 'epic'],
    gradient: 'from-orange-950 via-red-950 to-stone-900',
  },
  {
    id: 'toa',
    title: 'Tomb of Annihilation',
    levelRange: '1–11',
    setting: 'Chult (Forgotten Realms)',
    startingLocation: 'Port Nyanzaru, Chult',
    antagonistName: 'Acererak the Demilich',
    antagonistMotivation: 'Feed souls to the Soulmonger to fuel his undead apotheosis',
    openingHook: 'A death curse is killing all who have ever been resurrected — the source is somewhere deep in the jungles of Chult',
    description: 'A death curse is undoing all resurrections. Race through the jungles of Chult to destroy the Soulmonger.',
    factions: [
      { name: 'Merchant Princes of Port Nyanzaru', stance: 'neutral' },
      { name: 'Flaming Fist', stance: 'neutral' },
      { name: 'Undead', stance: 'hostile' },
    ],
    tags: ['jungle', 'death-curse', 'exploration'],
    gradient: 'from-green-950 via-yellow-950 to-stone-900',
  },
  {
    id: 'wbtw',
    title: 'Wild Beyond the Witchlight',
    levelRange: '1–8',
    setting: 'The Feywild',
    startingLocation: 'The Witchlight Carnival',
    antagonistName: 'The Hourglass Coven',
    antagonistMotivation: 'Each hag hoards stolen dreams and refuses to return what the party seeks',
    openingHook: 'The Witchlight Carnival has returned — the party senses something was stolen from them long ago and follows it into the Feywild',
    description: 'Something was stolen from you as a child. Follow the Witchlight Carnival into the Feywild to reclaim it.',
    factions: [
      { name: "Zybilna's Court", stance: 'neutral' },
      { name: 'Korreds', stance: 'ally' },
      { name: 'Hourglass Coven', stance: 'hostile' },
    ],
    tags: ['feywild', 'whimsy', 'mystery'],
    gradient: 'from-pink-950 via-fuchsia-950 to-purple-950',
  },
  {
    id: 'skt',
    title: "Storm King's Thunder",
    levelRange: '1–11',
    setting: 'Forgotten Realms (Sword Coast + North)',
    startingLocation: 'Nightstone, a small town near Waterdeep',
    antagonistName: 'Iymrith the Ancient Blue Dragon',
    antagonistMotivation: 'Sow chaos among the giant lords to prevent any one giant king from rising to power',
    openingHook: 'Giants are attacking settlements across the North — the ordning (giant hierarchy) has shattered and no one knows why',
    description: 'Giants rampage across the Sword Coast. Unravel the conspiracy behind the shattered ordning before civilization falls.',
    factions: [
      { name: "Lords' Alliance", stance: 'ally' },
      { name: 'Harpers', stance: 'ally' },
      { name: 'Giant Lords', stance: 'hostile' },
    ],
    tags: ['giants', 'open-world', 'epic'],
    gradient: 'from-sky-950 via-slate-900 to-stone-900',
  },
  {
    id: 'oota',
    title: 'Out of the Abyss',
    levelRange: '1–15',
    setting: 'The Underdark',
    startingLocation: 'Velkenvelve, a drow outpost deep in the Underdark',
    antagonistName: 'Demon Lords',
    antagonistMotivation: 'The demon lords have been summoned into the Underdark and spread madness through its depths',
    openingHook: 'The party wakes in chains in a drow prison — they must escape the Underdark before demon lords consume it',
    description: 'Escape from drow captivity in the Underdark while demon lords tear it apart around you.',
    factions: [
      { name: 'Drow of House Baenre', stance: 'hostile' },
      { name: 'Emerald Enclave', stance: 'ally' },
      { name: 'Gnomes of Blingdenstone', stance: 'ally' },
    ],
    tags: ['underdark', 'survival', 'demon-lords'],
    gradient: 'from-purple-950 via-indigo-950 to-slate-900',
  },
  {
    id: 'pota',
    title: 'Princes of the Apocalypse',
    levelRange: '1–15',
    setting: 'Forgotten Realms (Dessarin Valley)',
    startingLocation: 'Red Larch, Dessarin Valley',
    antagonistName: 'The Elder Elemental Eye',
    antagonistMotivation: 'Free the elder elemental princes and remake the world in primal chaos',
    openingHook: 'Strange things are happening in the Dessarin Valley — missing delegations, weird weather, and cults spreading through the countryside',
    description: 'Four elemental cults seek to unleash catastrophic power on the Sword Coast. Stop them before the prophets summon their gods.',
    factions: [
      { name: 'Harpers', stance: 'ally' },
      { name: 'Emerald Enclave', stance: 'ally' },
      { name: 'Crushing Wave', stance: 'hostile' },
    ],
    tags: ['elemental', 'dungeon-crawl', 'open-world'],
    gradient: 'from-amber-950 via-stone-900 to-teal-950',
  },
  {
    id: 'hotdq',
    title: 'Hoard of the Dragon Queen',
    levelRange: '1–8',
    setting: 'Forgotten Realms (Sword Coast)',
    startingLocation: 'Greenest, a town under dragon attack',
    antagonistName: 'Severin Silrajin',
    antagonistMotivation: "Collect the Dragon Hoard to fund Tiamat's return from the Nine Hells",
    openingHook: 'A blue dragon and the Cult of the Dragon attack Greenest — the party arrives as the town burns',
    description: 'The Cult of the Dragon is assembling a hoard to free Tiamat. Stop them before the Dragon Queen returns.',
    factions: [
      { name: 'Harpers', stance: 'ally' },
      { name: "Lords' Alliance", stance: 'ally' },
      { name: 'Cult of the Dragon', stance: 'hostile' },
    ],
    tags: ['dragons', 'tyranny', 'epic'],
    gradient: 'from-yellow-950 via-orange-950 to-red-950',
  },
  {
    id: 'gos',
    title: 'Ghosts of Saltmarsh',
    levelRange: '1–12',
    setting: 'Greyhawk (Saltmarsh)',
    startingLocation: 'Saltmarsh, a fishing town on the Azure Sea',
    antagonistName: 'The Scarlet Brotherhood',
    antagonistMotivation: "Destabilize Saltmarsh's trade routes and gain control of the Azure Sea",
    openingHook: 'A haunted mansion on the cliffs above Saltmarsh hides something far more dangerous than ghosts',
    description: "Saltmarsh faces threats from land and sea — smugglers, sea creatures, and a spy network conspiring against the town.",
    factions: [
      { name: 'Saltmarsh Council', stance: 'ally' },
      { name: 'Scarlet Brotherhood', stance: 'hostile' },
      { name: 'Sahuagin', stance: 'hostile' },
    ],
    tags: ['nautical', 'investigation', 'anthology'],
    gradient: 'from-teal-950 via-blue-950 to-slate-900',
  },
  {
    id: 'kftgv',
    title: 'Keys from the Golden Vault',
    levelRange: '1–11',
    setting: 'Various (anthology)',
    startingLocation: 'The Golden Vault (mysterious benefactor)',
    antagonistName: 'Varies per mission',
    antagonistMotivation: 'The Golden Vault sends the party on heist missions for unknown but ostensibly good reasons',
    openingHook: 'A golden music box appears with a key inside — and instructions for a job that must go perfectly',
    description: 'Thirteen heist missions from a mysterious benefactor. Steal, infiltrate, and outmaneuver in style.',
    factions: [
      { name: 'The Golden Vault', stance: 'ally' },
      { name: 'Targets vary', stance: 'hostile' },
    ],
    tags: ['heist', 'anthology', 'one-shots'],
    gradient: 'from-amber-950 via-yellow-950 to-stone-900',
  },
  {
    id: 'lox',
    title: 'Spelljammer: Light of Xaryxis',
    levelRange: '5–8',
    setting: 'Wildspace / Astral Sea',
    startingLocation: 'A port city attacked from space',
    antagonistName: 'Emperor Xeleth',
    antagonistMotivation: 'Drain the life force of entire worlds to power their dying sun',
    openingHook: 'Astral elves descend from the sky and drain the life from the earth — the party must take the fight to space',
    description: 'Chase astral elves across the cosmos to stop them from killing your home world.',
    factions: [
      { name: 'Giff', stance: 'ally' },
      { name: 'Rock Gnomes', stance: 'ally' },
      { name: 'Xaryxian Empire', stance: 'hostile' },
    ],
    tags: ['spelljammer', 'space', 'action'],
    gradient: 'from-indigo-950 via-violet-950 to-slate-900',
  },
  {
    id: 'tso',
    title: 'Phandelver and Below: The Shattered Obelisk',
    levelRange: '1–12',
    setting: 'Forgotten Realms (Phandalin region)',
    startingLocation: 'Phandalin',
    antagonistName: 'Ilvaash the Godlet',
    antagonistMotivation: 'Shatter an ancient obelisk to open a portal to the Far Realm and transform all life into mind flayers',
    openingHook: 'Phandalin is under attack by mind flayers — and something in the Far Realm is pulling the strings',
    description: 'A Far Realm horror threatens Phandalin and all life beyond it. Stop the mind flayer cult before the portal opens.',
    factions: [
      { name: 'Harpers', stance: 'ally' },
      { name: 'Emerald Enclave', stance: 'ally' },
      { name: 'Cult of Ilvaash', stance: 'hostile' },
    ],
    tags: ['psionic', 'illithid', 'horror'],
    gradient: 'from-violet-950 via-purple-950 to-slate-900',
  },
];

export const ADVENTURE_TAGS = ['All', 'City', 'Horror', 'Dungeon', 'Wilderness', 'Heist', 'Multiplanar', 'Space'] as const;
export type AdventureTag = typeof ADVENTURE_TAGS[number];
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors on the new file

- [ ] **Step 3: Commit**

```bash
git add src/lib/adventure-templates.ts
git commit -m "feat: add adventure templates static data (16 published 5e adventures)"
```

---

### Task 2: AdventurePicker component

**Files:**
- Create: `src/components/create/adventure-picker.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADVENTURE_TEMPLATES, ADVENTURE_TAGS, type AdventureTemplate, type AdventureTag } from '@/lib/adventure-templates';

const TAG_TO_TEMPLATE_TAGS: Record<string, string[]> = {
  'City': ['city'],
  'Horror': ['horror', 'gothic'],
  'Dungeon': ['dungeon-crawl'],
  'Wilderness': ['wilderness', 'jungle', 'survival', 'exploration'],
  'Heist': ['heist'],
  'Multiplanar': ['multiplanar', 'spelljammer', 'space'],
  'Space': ['space', 'spelljammer'],
};

interface AdventurePickerProps {
  value: AdventureTemplate | null;
  onChange: (adventure: AdventureTemplate) => void;
}

export function AdventurePicker({ value, onChange }: AdventurePickerProps) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<AdventureTag>('All');

  const filtered = ADVENTURE_TEMPLATES.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag =
      activeTag === 'All' || (TAG_TO_TEMPLATE_TAGS[activeTag] ?? []).some((t) => a.tags.includes(t));
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-3 mt-4">
      <Input
        placeholder="Search adventures..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        {ADVENTURE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(tag)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeTag === tag
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((adventure) => (
          <button
            key={adventure.id}
            type="button"
            onClick={() => onChange(adventure)}
            className={cn(
              'group rounded-lg overflow-hidden border transition-all text-left',
              value?.id === adventure.id
                ? 'border-amber-500/60 ring-2 ring-amber-500/40 shadow-[0_0_12px_hsl(35_80%_55%/0.15)]'
                : 'border-border/40 hover:border-amber-500/30'
            )}
          >
            <div className={cn('h-16 w-full bg-gradient-to-br', adventure.gradient)} />
            <div className="p-2 space-y-1 bg-stone-900/80">
              <p className="text-xs font-semibold leading-tight line-clamp-2">{adventure.title}</p>
              <p className="text-[10px] text-muted-foreground">{adventure.levelRange}</p>
              <div className="flex flex-wrap gap-1">
                {adventure.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[9px] rounded-full bg-stone-800 px-1.5 py-0.5 text-muted-foreground/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No adventures match your search.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/create/adventure-picker.tsx
git commit -m "feat: add AdventurePicker component with search and tag filtering"
```

---

### Task 3: PartyImportStep component

**Files:**
- Create: `src/components/create/party-import-step.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NextLink from 'next/link';
import { cn } from '@/lib/utils';

interface PartyImportStepProps {
  campaignUrl: string;
  onChange: (url: string) => void;
  hasCobalt: boolean;
}

function isValidDdbCampaignUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.dndbeyond.com' || parsed.hostname === 'dndbeyond.com') &&
      parsed.pathname.startsWith('/campaigns/')
    );
  } catch {
    return false;
  }
}

export function PartyImportStep({ campaignUrl, onChange, hasCobalt }: PartyImportStepProps) {
  const isValid = campaignUrl !== '' && isValidDdbCampaignUrl(campaignUrl);
  const isInvalid = campaignUrl !== '' && !isValidDdbCampaignUrl(campaignUrl);

  if (!hasCobalt) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-amber-300 font-medium">D&D Beyond token not configured</p>
            <p className="text-xs text-muted-foreground">
              Add your Cobalt token in Settings to enable D&D Beyond party import.
            </p>
          </div>
        </div>
        <NextLink
          href="/settings/api-keys"
          className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Go to Settings → API Keys
        </NextLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ddb-campaign-url">D&D Beyond Campaign URL</Label>
        <Input
          id="ddb-campaign-url"
          placeholder="https://www.dndbeyond.com/campaigns/12345"
          value={campaignUrl}
          onChange={(e) => onChange(e.target.value)}
          className={cn(isInvalid && 'border-destructive/60')}
        />
        {isInvalid && (
          <p className="text-xs text-destructive">
            Enter a valid D&D Beyond campaign URL (e.g. https://www.dndbeyond.com/campaigns/12345)
          </p>
        )}
        {isValid && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Party will be imported when the campaign is created
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/create/party-import-step.tsx
git commit -m "feat: add PartyImportStep component for D&D Beyond party URL capture"
```

---

### Task 4: Wizard page orchestrator

**Files:**
- Rewrite: `src/app/(app)/campaigns/new/page.tsx`

The banner upload logic and `CampaignPreview` are preserved and adapted. All old form content (players, advanced settings, doc import, tone chips) is removed.

- [ ] **Step 1: Rewrite the page**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, BookOpen, Scroll, Plus, Trash2, ChevronRight } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';
import { AdventurePicker } from '@/components/create/adventure-picker';
import { PartyImportStep } from '@/components/create/party-import-step';
import { cn } from '@/lib/utils';
import { type AdventureTemplate } from '@/lib/adventure-templates';

type Faction = { name: string; stance: 'ally' | 'neutral' | 'hostile' };

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors',
              s < current
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : s === current
                  ? 'bg-amber-500/30 border-amber-500 text-amber-200'
                  : 'bg-transparent border-border/40 text-muted-foreground/40'
            )}
          >
            {s}
          </div>
          {s < total && (
            <div className={cn('h-px w-6', s < current ? 'bg-amber-500/40' : 'bg-border/30')} />
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignPreview({
  name,
  description,
  bannerUrl,
  adventure,
}: {
  name: string;
  description: string;
  bannerUrl: string | null;
  adventure: AdventureTemplate | null;
}) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      {bannerUrl ? (
        <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
      ) : adventure ? (
        <div className={cn('h-24 w-full bg-gradient-to-br', adventure.gradient)} />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || (adventure ? adventure.title : <span className="text-muted-foreground/40">Your Campaign</span>)}
          </h3>
          <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">
            Draft
          </Badge>
        </div>
        {adventure && !name && (
          <p className="text-[10px] text-amber-400/70">{adventure.levelRange} · {adventure.setting}</p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || adventure?.description || <span className="opacity-40">No description</span>}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/50 pt-1">
          <span>0 sessions</span>
          <span>·</span>
          <span>0 NPCs</span>
        </div>
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [path, setPath] = useState<'published' | 'original' | null>(null);
  const [selectedAdventure, setSelectedAdventure] = useState<AdventureTemplate | null>(null);
  const [ddbCampaignUrl, setDdbCampaignUrl] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [antagonistMotivation, setAntagonistMotivation] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [factions, setFactions] = useState<Faction[]>([]);
  const [storyText, setStoryText] = useState('');
  const [nameError, setNameError] = useState('');

  const settingsQuery = trpc.userSettings.getSettings.useQuery();
  const hasCobalt = settingsQuery.data?.hasDndBeyondCobaltCookie ?? false;

  const createCampaign = trpc.campaigns.create.useMutation({
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  const seedFromCreation = trpc.brain.seedFromCreation.useMutation();
  const importFromCampaign = trpc.charactersDndBeyond.importFromCampaign.useMutation();

  function handleSelectAdventure(adventure: AdventureTemplate) {
    setSelectedAdventure(adventure);
    setName(adventure.title);
    setDescription(adventure.description);
    setStartingLocation(adventure.startingLocation);
    setAntagonistName(adventure.antagonistName);
    setAntagonistMotivation(adventure.antagonistMotivation);
    setOpeningHook(adventure.openingHook);
    setFactions(adventure.factions.map((f) => ({ ...f })));
    setStoryText('');
  }

  function handleSelectPath(selected: 'published' | 'original') {
    setPath(selected);
    if (selected === 'original') {
      setSelectedAdventure(null);
      setName('');
      setDescription('');
      setStartingLocation('');
      setAntagonistName('');
      setAntagonistMotivation('');
      setOpeningHook('');
      setFactions([]);
      setStoryText('');
    }
  }

  async function handleBannerUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'JPEG, PNG, WebP, or GIF only', variant: 'destructive' });
      return;
    }
    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/campaign-banner', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      setBannerUrl(data.url);
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingBanner(false);
    }
  }

  function canProceedStep1() {
    if (path === 'original') return true;
    if (path === 'published') return selectedAdventure !== null;
    return false;
  }

  async function handleCreate() {
    if (!name.trim()) {
      setNameError('Campaign name is required');
      return;
    }
    setNameError('');

    let campaign: { id: string; slug: string };
    try {
      campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        bannerUrl: bannerUrl ?? undefined,
      });
    } catch {
      return;
    }

    if (ddbCampaignUrl.trim()) {
      importFromCampaign.mutate({
        campaignUrl: ddbCampaignUrl.trim(),
        campaignId: campaign.id,
      });
    }

    const hasWorldData =
      startingLocation.trim() !== '' ||
      antagonistName.trim() !== '' ||
      openingHook.trim() !== '' ||
      storyText.trim() !== '' ||
      factions.some((f) => f.name.trim() !== '');

    if (hasWorldData) {
      seedFromCreation.mutate({
        campaignId: campaign.id,
        worldSetup: {
          startingLocation: startingLocation.trim() || undefined,
          antagonistName: antagonistName.trim() || undefined,
          antagonistMotivation: antagonistMotivation.trim() || undefined,
          openingHook: openingHook.trim() || undefined,
          factions: factions
            .filter((f) => f.name.trim() !== '')
            .map((f) => ({ name: f.name.trim(), stance: f.stance })),
        },
        storyText: storyText.trim() || undefined,
      });
    }

    router.push(`/campaigns/${campaign.slug || campaign.id}`);
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Campaign"
      preview={
        <CampaignPreview
          name={name}
          description={description}
          bannerUrl={bannerUrl}
          adventure={selectedAdventure}
        />
      }
    >
      <div className="glass-panel glass-grain rounded-xl p-6">
        <StepIndicator current={step} total={4} />

        {/* Step 1: Choose Path */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 1 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Choose your path</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectPath('published')}
                className={cn(
                  'rounded-xl border p-5 text-left transition-all space-y-2',
                  path === 'published'
                    ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-border/50 hover:border-amber-500/30 hover:bg-stone-900/40'
                )}
              >
                <BookOpen className={cn('h-6 w-6', path === 'published' ? 'text-amber-400' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-semibold">Published Adventure</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose from 16 official 5e adventures</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPath('original')}
                className={cn(
                  'rounded-xl border p-5 text-left transition-all space-y-2',
                  path === 'original'
                    ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-border/50 hover:border-amber-500/30 hover:bg-stone-900/40'
                )}
              >
                <Scroll className={cn('h-6 w-6', path === 'original' ? 'text-amber-400' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-semibold">Original Campaign</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Build your own world from scratch</p>
                </div>
              </button>
            </div>

            {path === 'published' && (
              <AdventurePicker value={selectedAdventure} onChange={handleSelectAdventure} />
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" disabled={!canProceedStep1()} onClick={() => setStep(2)}>
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Party Import */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 2 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Import your party</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bring in your players from D&D Beyond. You can skip this and do it later.
              </p>
            </div>

            <PartyImportStep
              campaignUrl={ddbCampaignUrl}
              onChange={setDdbCampaignUrl}
              hasCobalt={hasCobalt}
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now →
                </button>
                <Button type="button" onClick={() => setStep(3)}>
                  Next
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: World Setup */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="label-overline mb-1">Step 3 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">World setup</h2>
              {selectedAdventure && (
                <p className="text-xs text-amber-400/70 mt-1">
                  Pre-filled from {selectedAdventure.title} — edit freely
                </p>
              )}
            </div>

            {/* Identity */}
            <div className="space-y-3">
              <p className="label-overline">Campaign Identity</p>
              <div className="section-rule" />
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="Curse of Strahd"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  aria-invalid={!!nameError}
                  maxLength={100}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="A Gothic horror adventure in the mists of Barovia..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Banner */}
            <div className="space-y-3">
              <p className="label-overline">Banner Image</p>
              <div className="section-rule" />
              <div
                className={cn(
                  'relative rounded-lg border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer overflow-hidden',
                  uploadingBanner && 'pointer-events-none opacity-60'
                )}
                onClick={() => bannerInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handleBannerUpload(file);
                }}
              >
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBannerUpload(file);
                  }}
                />
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Campaign banner" className="h-28 w-full object-cover rounded-lg" />
                ) : (
                  <div className="h-28 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex flex-col items-center justify-center gap-2">
                    {uploadingBanner ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground/50">Drop an image or click to upload</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* World fields */}
            <div className="space-y-3">
              <p className="label-overline">World</p>
              <div className="section-rule" />
              <div className="rounded-lg border border-border/40 bg-stone-900/40 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startingLocation">Starting Location</Label>
                    <Input
                      id="startingLocation"
                      placeholder="Waterdeep"
                      value={startingLocation}
                      maxLength={200}
                      onChange={(e) => setStartingLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="antagonistName">Main Antagonist</Label>
                    <Input
                      id="antagonistName"
                      placeholder="Strahd von Zarovich"
                      value={antagonistName}
                      maxLength={200}
                      onChange={(e) => setAntagonistName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="antagonistMotivation">Antagonist Motivation</Label>
                  <Input
                    id="antagonistMotivation"
                    placeholder="Seeks to break an ancient curse..."
                    value={antagonistMotivation}
                    maxLength={200}
                    onChange={(e) => setAntagonistMotivation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingHook">Opening Hook</Label>
                  <Input
                    id="openingHook"
                    placeholder="A merchant is found dead with a strange symbol..."
                    value={openingHook}
                    maxLength={200}
                    onChange={(e) => setOpeningHook(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Factions */}
            <div className="space-y-3">
              <p className="label-overline">Factions</p>
              <div className="section-rule" />
              <div className="space-y-2">
                {factions.map((faction, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                    <Input
                      placeholder="Faction name"
                      value={faction.name}
                      maxLength={100}
                      onChange={(e) =>
                        setFactions((prev) => prev.map((f, i) => (i === idx ? { ...f, name: e.target.value } : f)))
                      }
                    />
                    <Select
                      value={faction.stance}
                      onValueChange={(v) =>
                        setFactions((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, stance: v as 'ally' | 'neutral' | 'hostile' } : f))
                        )
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ally">Ally</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="hostile">Hostile</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setFactions((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {factions.length < 3 && (
                <button
                  type="button"
                  onClick={() => setFactions((prev) => [...prev, { name: '', stance: 'neutral' }])}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add faction
                </button>
              )}
            </div>

            {/* Story So Far */}
            <div className="space-y-3">
              <p className="label-overline">Story So Far</p>
              <div className="section-rule" />
              <Textarea
                placeholder="Note where in the adventure you're starting, or paste campaign history..."
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                maxLength={20000}
                rows={4}
                className="resize-none"
              />
              {storyText.length > 0 && (
                <p className="text-xs text-muted-foreground">{storyText.length.toLocaleString()} / 20,000</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <Button type="button" onClick={() => setStep(4)}>
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm & Create */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Step 4 of 4</p>
              <div className="section-rule" />
              <h2 className="font-display text-lg font-semibold mt-3">Confirm & create</h2>
            </div>

            <div className="rounded-lg border border-border/40 bg-stone-900/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Adventure</p>
                  <p className="text-sm font-medium">
                    {selectedAdventure ? selectedAdventure.title : 'Original Campaign'}
                  </p>
                </div>
                {selectedAdventure && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                    {selectedAdventure.levelRange}
                  </Badge>
                )}
              </div>
              <div className="h-px bg-border/30" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{name || <span className="text-muted-foreground/50">Not set</span>}</p>
              </div>
              {startingLocation && (
                <div>
                  <p className="text-xs text-muted-foreground">Starting Location</p>
                  <p className="text-sm">{startingLocation}</p>
                </div>
              )}
              {antagonistName && (
                <div>
                  <p className="text-xs text-muted-foreground">Antagonist</p>
                  <p className="text-sm">{antagonistName}</p>
                </div>
              )}
              <div className="h-px bg-border/30" />
              <div>
                <p className="text-xs text-muted-foreground">Party Import</p>
                <p className="text-sm">
                  {ddbCampaignUrl ? 'D&D Beyond campaign linked — importing on creation' : 'No party imported yet'}
                </p>
              </div>
            </div>

            {createCampaign.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {createCampaign.error.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <Button type="button" onClick={handleCreate} disabled={createCampaign.isPending}>
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Campaign'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CreatePageShell>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/campaigns/new/page.tsx
git commit -m "feat(campaigns): replace creation form with 4-step wizard"
```

---

### Task 5: Update E2E tests

**Files:**
- Rewrite: `tests/workflows/campaign-create.spec.ts`

Current tests reference `'Tone & Themes'`, `'Players'`, `'Import Documents'`, player rows, and tone chip interactions — none of which exist in the wizard. Replace with wizard-aware tests.

- [ ] **Step 1: Rewrite the test file**

```ts
import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('campaign create wizard — original campaign path, create redirects', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-wizard', async () => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL('/campaigns/new');
    await expect(page.getByText('Choose your path')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Published Adventure')).toBeVisible();
    await expect(page.getByText('Original Campaign')).toBeVisible();
  }, 8_000);

  await checkpoint(testInfo, 'step1-original', async () => {
    await page.getByText('Original Campaign').click();
    const nextBtn = page.getByRole('button', { name: /^next$/i });
    await expect(nextBtn).toBeEnabled({ timeout: 3_000 });
    await nextBtn.click();
  }, 5_000);

  await checkpoint(testInfo, 'step2-skip', async () => {
    await expect(page.getByText('Import your party')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Skip for now').click();
  }, 5_000);

  await checkpoint(testInfo, 'step3-fill-name', async () => {
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    const uniqueName = `QA Campaign ${Date.now()}`;
    await page.getByLabel(/campaign name/i).fill(uniqueName);
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 5_000);

  await checkpoint(testInfo, 'step4-create', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Original Campaign')).toBeVisible();
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create wizard — published adventure pre-fills step 3', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'step1-published', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Published Adventure').click();
    await expect(page.getByPlaceholder('Search adventures...')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Curse of Strahd').first().click();
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step2-skip', async () => {
    await expect(page.getByText('Import your party')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Skip for now').click();
  }, 5_000);

  await checkpoint(testInfo, 'step3-prefilled', async () => {
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/campaign name/i)).toHaveValue('Curse of Strahd', { timeout: 3_000 });
    await expect(page.locator('input#startingLocation')).toHaveValue(/Barovia/i);
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 8_000);

  await checkpoint(testInfo, 'step4-create', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Curse of Strahd')).toBeVisible();
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create wizard — adventure search filter works', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'search-filter', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Published Adventure').click();
    await expect(page.getByPlaceholder('Search adventures...')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('Search adventures...').fill('Dragon Heist');
    await expect(page.getByText('Waterdeep: Dragon Heist')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Curse of Strahd')).not.toBeVisible();
  }, 8_000);
});

test('campaign create wizard — create without name shows validation error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-step4', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Original Campaign').click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByText('Skip for now').click();
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'create-without-name', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page.getByText('Campaign name is required')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL('/campaigns/new');
  }, 8_000);
});
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit and push**

```bash
git add tests/workflows/campaign-create.spec.ts
git commit -m "test(campaigns): update E2E workflow tests for 4-step wizard"
git push origin main
```
