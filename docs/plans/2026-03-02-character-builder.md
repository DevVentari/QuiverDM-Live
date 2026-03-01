# Character Builder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Expand the character create page into a full tabbed character builder with SRD options (Races, Classes, Backgrounds) and the user's homebrew library.

**Architecture:** The existing `/characters/new` page (already using `CreatePageShell` split layout) is rewritten to add a 5-tab form: Details | Race | Class | Background | Ability Scores. Name + portrait stay in Details. SRD data is bundled as a typed TS file in `src/data/`. Each tab queries `trpc.homebrew.getContent` filtered by type to append homebrew options below SRD options. The `CharacterPreview` left panel updates live across all tabs. Submit is always available at the bottom.

**Tech Stack:** Next.js 15 App Router, React, tRPC (getContent with type filter), shadcn/ui Tabs, Tailwind CSS

---

### Task 1: SRD data file

**File:**
- Create: `src/data/srd-characters.ts`

**Step 1: Create the file with all SRD races, classes, backgrounds**

```typescript
// SRD 5.1 Creative Commons — Races, Classes, Backgrounds

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface SrdRace {
  id: string;
  name: string;
  abilityBonuses: Partial<Record<AbilityKey, number>>;
  speed: number;
  size: 'Small' | 'Medium';
  traits: string[];
}

export interface SrdClass {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility: string;
  savingThrows: AbilityKey[];
  description: string;
}

export interface SrdBackground {
  id: string;
  name: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  description: string;
}

export const SRD_RACES: SrdRace[] = [
  { id: 'dragonborn', name: 'Dragonborn', abilityBonuses: { str: 2, cha: 1 }, speed: 30, size: 'Medium', traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'] },
  { id: 'dwarf-hill', name: 'Dwarf (Hill)', abilityBonuses: { con: 2, wis: 1 }, speed: 25, size: 'Medium', traits: ['Darkvision', 'Dwarven Resilience', 'Stonecunning'] },
  { id: 'elf-high', name: 'Elf (High)', abilityBonuses: { dex: 2, int: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Fey Ancestry', 'Trance', 'Keen Senses'] },
  { id: 'gnome-rock', name: 'Gnome (Rock)', abilityBonuses: { int: 2, con: 1 }, speed: 25, size: 'Small', traits: ['Darkvision', 'Gnome Cunning', "Artificer's Lore", 'Tinker'] },
  { id: 'half-elf', name: 'Half-Elf', abilityBonuses: { cha: 2 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility', '+1 to two ability scores of your choice'] },
  { id: 'half-orc', name: 'Half-Orc', abilityBonuses: { str: 2, con: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'] },
  { id: 'halfling-lightfoot', name: 'Halfling (Lightfoot)', abilityBonuses: { dex: 2, cha: 1 }, speed: 25, size: 'Small', traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Naturally Stealthy'] },
  { id: 'human', name: 'Human', abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, size: 'Medium', traits: ['Extra Language', '+1 to all ability scores'] },
  { id: 'tiefling', name: 'Tiefling', abilityBonuses: { cha: 2, int: 1 }, speed: 30, size: 'Medium', traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'] },
];

export const SRD_CLASSES: SrdClass[] = [
  { id: 'barbarian', name: 'Barbarian', hitDie: 12, primaryAbility: 'STR', savingThrows: ['str', 'con'], description: 'A fierce warrior who can enter a battle rage.' },
  { id: 'bard', name: 'Bard', hitDie: 8, primaryAbility: 'CHA', savingThrows: ['dex', 'cha'], description: 'An inspiring magician whose power echoes the music of creation.' },
  { id: 'cleric', name: 'Cleric', hitDie: 8, primaryAbility: 'WIS', savingThrows: ['wis', 'cha'], description: 'A priestly champion who wields divine magic in service of a higher power.' },
  { id: 'druid', name: 'Druid', hitDie: 8, primaryAbility: 'WIS', savingThrows: ['int', 'wis'], description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.' },
  { id: 'fighter', name: 'Fighter', hitDie: 10, primaryAbility: 'STR or DEX', savingThrows: ['str', 'con'], description: 'A master of martial combat, skilled with a variety of weapons and armor.' },
  { id: 'monk', name: 'Monk', hitDie: 8, primaryAbility: 'DEX & WIS', savingThrows: ['str', 'dex'], description: 'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.' },
  { id: 'paladin', name: 'Paladin', hitDie: 10, primaryAbility: 'STR & CHA', savingThrows: ['wis', 'cha'], description: 'A holy warrior bound to a sacred oath.' },
  { id: 'ranger', name: 'Ranger', hitDie: 10, primaryAbility: 'DEX & WIS', savingThrows: ['str', 'dex'], description: 'A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.' },
  { id: 'rogue', name: 'Rogue', hitDie: 8, primaryAbility: 'DEX', savingThrows: ['dex', 'int'], description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.' },
  { id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primaryAbility: 'CHA', savingThrows: ['con', 'cha'], description: 'A spellcaster who draws on inherent magic from a gift or bloodline.' },
  { id: 'warlock', name: 'Warlock', hitDie: 8, primaryAbility: 'CHA', savingThrows: ['wis', 'cha'], description: 'A wielder of magic derived from a bargain with an extraplanar entity.' },
  { id: 'wizard', name: 'Wizard', hitDie: 6, primaryAbility: 'INT', savingThrows: ['int', 'wis'], description: 'A scholarly magic-user capable of manipulating the structures of reality.' },
];

export const SRD_BACKGROUNDS: SrdBackground[] = [
  { id: 'acolyte', name: 'Acolyte', skillProficiencies: ['Insight', 'Religion'], toolProficiencies: ['Two languages'], description: 'You have spent your life in service to a temple.' },
  { id: 'charlatan', name: 'Charlatan', skillProficiencies: ['Deception', 'Sleight of Hand'], toolProficiencies: ['Disguise kit', 'Forgery kit'], description: 'You have always had a knack for making people believe what you tell them.' },
  { id: 'criminal', name: 'Criminal', skillProficiencies: ['Deception', 'Stealth'], toolProficiencies: ['Gaming set', "Thieves' tools"], description: 'You are an experienced criminal with a history of breaking the law.' },
  { id: 'entertainer', name: 'Entertainer', skillProficiencies: ['Acrobatics', 'Performance'], toolProficiencies: ['Disguise kit', 'Musical instrument'], description: 'You thrive in front of an audience.' },
  { id: 'folk-hero', name: 'Folk Hero', skillProficiencies: ['Animal Handling', 'Survival'], toolProficiencies: ["Artisan's tools", 'Vehicles (land)'], description: 'You come from a humble social rank, but you are destined for so much more.' },
  { id: 'guild-artisan', name: 'Guild Artisan', skillProficiencies: ['Insight', 'Persuasion'], toolProficiencies: ["Artisan's tools", 'One language'], description: 'You are a member of an artisan\'s guild.' },
  { id: 'hermit', name: 'Hermit', skillProficiencies: ['Medicine', 'Religion'], toolProficiencies: ['Herbalism kit', 'One language'], description: 'You lived in seclusion for a formative part of your life.' },
  { id: 'noble', name: 'Noble', skillProficiencies: ['History', 'Persuasion'], toolProficiencies: ['Gaming set', 'One language'], description: 'You understand wealth, power, and privilege.' },
  { id: 'outlander', name: 'Outlander', skillProficiencies: ['Athletics', 'Survival'], toolProficiencies: ['Musical instrument', 'One language'], description: 'You grew up in the wilds, far from civilization.' },
  { id: 'sage', name: 'Sage', skillProficiencies: ['Arcana', 'History'], toolProficiencies: ['Two languages'], description: 'You spent years learning the lore of the multiverse.' },
  { id: 'sailor', name: 'Sailor', skillProficiencies: ['Athletics', 'Perception'], toolProficiencies: ["Navigator's tools", 'Vehicles (water)'], description: 'You sailed on a seagoing vessel for years.' },
  { id: 'soldier', name: 'Soldier', skillProficiencies: ['Athletics', 'Intimidation'], toolProficiencies: ['Gaming set', 'Vehicles (land)'], description: 'War has been your life for as long as you care to remember.' },
  { id: 'urchin', name: 'Urchin', skillProficiencies: ['Sleight of Hand', 'Stealth'], toolProficiencies: ['Disguise kit', "Thieves' tools"], description: 'You grew up on the streets alone, orphaned, and poor.' },
];
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "srd-characters"
```
Expected: no output

**Step 3: Commit**

```bash
git add src/data/srd-characters.ts
git commit -m "feat(data): add SRD 5.1 races, classes, backgrounds"
```

---

### Task 2: Rewrite character create page with tab shell

**File:**
- Modify: `src/app/(app)/characters/new/page.tsx`

This rewrites the page to use `Tabs` from shadcn/ui. All state lives here and is passed into tab components (which are inline in this file for now — we'll keep it as one file to avoid over-splitting).

**Step 1: Replace the entire file**

```tsx
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Check } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';
import {
  SRD_RACES, SRD_CLASSES, SRD_BACKGROUNDS,
  type SrdRace, type SrdClass, type SrdBackground, type AbilityKey,
} from '@/data/srd-characters';

// ─── Types ──────────────────────────────────────────────────────────────────

type AbilityScoreMethod = 'standard' | 'pointbuy' | 'manual';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

// Point buy cost table: score → cost (scores 8–15)
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;

type AbilityScores = Record<AbilityKey, number>;

const DEFAULT_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

// ─── Preview ─────────────────────────────────────────────────────────────────

interface PreviewProps {
  name: string;
  race: string;
  charClass: string;
  level: number;
  background: string;
  backstory: string;
  portraitUrl: string;
  uploading: boolean;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function CharacterPreview({
  name, race, charClass, level, background, backstory,
  portraitUrl, uploading, onUploadClick, onFileChange, fileInputRef,
}: PreviewProps) {
  const subtitle = [race, charClass, level ? `Level ${level}` : null].filter(Boolean).join(' · ');
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <label className="block relative h-24 w-full cursor-pointer group" onClick={onUploadClick}>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        {portraitUrl ? (
          <Image src={portraitUrl} alt="Character portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            ) : (
              <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/60 mt-1">Upload portrait</p>
              </div>
            )}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 transition-all rounded-t-xl pointer-events-none" />
      </label>
      <div className="p-4 space-y-1">
        <h3 className="font-display text-base font-bold truncate">
          {name || <span className="text-muted-foreground/40">Your Character</span>}
        </h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {background && <p className="text-xs text-muted-foreground/60">{background}</p>}
        {backstory && <p className="text-sm text-muted-foreground/70 line-clamp-2 pt-1">{backstory}</p>}
      </div>
    </div>
  );
}

// ─── Option Card ─────────────────────────────────────────────────────────────

function OptionCard({
  name, subtitle, meta, selected, isHomebrew, onClick,
}: {
  name: string;
  subtitle?: string;
  meta?: string;
  selected: boolean;
  isHomebrew?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full text-left rounded-lg border p-3 transition-all ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </span>
      )}
      <p className="text-sm font-semibold truncate pr-5">{name}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      {meta && <p className="text-xs text-muted-foreground/60 mt-0.5">{meta}</p>}
      {isHomebrew && (
        <Badge variant="outline" className="mt-1 text-[10px] py-0 text-amber-400 border-amber-500/30">
          Homebrew
        </Badge>
      )}
    </button>
  );
}

// ─── Race Tab ────────────────────────────────────────────────────────────────

function RaceTab({
  selectedRaceId, onSelect, homebrewRaces,
}: {
  selectedRaceId: string;
  onSelect: (race: SrdRace | null, name: string) => void;
  homebrewRaces: any[];
}) {
  const [search, setSearch] = useState('');
  const filtered = SRD_RACES.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredHomebrew = homebrewRaces.filter((r: any) =>
    (r.name as string).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search races…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((race) => {
          const bonuses = Object.entries(race.abilityBonuses)
            .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
            .join(', ');
          return (
            <OptionCard
              key={race.id}
              name={race.name}
              subtitle={bonuses}
              meta={`${race.size} · ${race.speed}ft`}
              selected={selectedRaceId === race.id}
              onClick={() => onSelect(race, race.name)}
            />
          );
        })}
        {filteredHomebrew.map((r: any) => (
          <OptionCard
            key={r.id}
            name={r.name}
            isHomebrew
            selected={selectedRaceId === r.id}
            onClick={() => onSelect(null, r.name)}
          />
        ))}
      </div>
      {filtered.length === 0 && filteredHomebrew.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No races found</p>
      )}
    </div>
  );
}

// ─── Class Tab ───────────────────────────────────────────────────────────────

function ClassTab({
  selectedClassId, onSelect, homebrewClasses,
}: {
  selectedClassId: string;
  onSelect: (cls: SrdClass | null, name: string) => void;
  homebrewClasses: any[];
}) {
  const [search, setSearch] = useState('');
  const filtered = SRD_CLASSES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredHomebrew = homebrewClasses.filter((c: any) =>
    (c.name as string).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search classes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((cls) => (
          <OptionCard
            key={cls.id}
            name={cls.name}
            subtitle={`Primary: ${cls.primaryAbility}`}
            meta={`d${cls.hitDie} hit die`}
            selected={selectedClassId === cls.id}
            onClick={() => onSelect(cls, cls.name)}
          />
        ))}
        {filteredHomebrew.map((c: any) => (
          <OptionCard
            key={c.id}
            name={c.name}
            isHomebrew
            selected={selectedClassId === c.id}
            onClick={() => onSelect(null, c.name)}
          />
        ))}
      </div>
      {filtered.length === 0 && filteredHomebrew.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No classes found</p>
      )}
    </div>
  );
}

// ─── Background Tab ──────────────────────────────────────────────────────────

function BackgroundTab({
  selectedBackgroundId, onSelect, homebrewBackgrounds,
}: {
  selectedBackgroundId: string;
  onSelect: (bg: SrdBackground | null, name: string) => void;
  homebrewBackgrounds: any[];
}) {
  const [search, setSearch] = useState('');
  const filtered = SRD_BACKGROUNDS.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  const filteredHomebrew = homebrewBackgrounds.filter((b: any) =>
    (b.name as string).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search backgrounds…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((bg) => (
          <OptionCard
            key={bg.id}
            name={bg.name}
            subtitle={bg.skillProficiencies.join(', ')}
            selected={selectedBackgroundId === bg.id}
            onClick={() => onSelect(bg, bg.name)}
          />
        ))}
        {filteredHomebrew.map((b: any) => (
          <OptionCard
            key={b.id}
            name={b.name}
            isHomebrew
            selected={selectedBackgroundId === b.id}
            onClick={() => onSelect(null, b.name)}
          />
        ))}
      </div>
      {filtered.length === 0 && filteredHomebrew.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No backgrounds found</p>
      )}
    </div>
  );
}

// ─── Ability Scores Tab ──────────────────────────────────────────────────────

function AbilityScoresTab({
  method, onMethodChange, scores, onScoresChange,
}: {
  method: AbilityScoreMethod;
  onMethodChange: (m: AbilityScoreMethod) => void;
  scores: AbilityScores;
  onScoresChange: (s: AbilityScores) => void;
}) {
  // Standard array: track which value is assigned to which ability
  const usedValues = Object.values(scores) as number[];
  const available = STANDARD_ARRAY.filter((v) => !usedValues.includes(v));

  // Point buy: total spent
  const pointsSpent = ABILITY_KEYS.reduce((sum, k) => sum + (POINT_COST[scores[k]] ?? 0), 0);
  const pointsLeft = POINT_BUY_BUDGET - pointsSpent;

  const setScore = (key: AbilityKey, val: number) => onScoresChange({ ...scores, [key]: val });

  return (
    <div className="space-y-4">
      {/* Method selector */}
      <div className="flex gap-2">
        {(['standard', 'pointbuy', 'manual'] as AbilityScoreMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              onMethodChange(m);
              if (m === 'standard') {
                onScoresChange({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
              } else if (m === 'pointbuy') {
                onScoresChange({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
              }
            }}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              method === m
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-white/20'
            }`}
          >
            {m === 'standard' ? 'Standard Array' : m === 'pointbuy' ? 'Point Buy' : 'Manual'}
          </button>
        ))}
      </div>

      {/* Point buy budget */}
      {method === 'pointbuy' && (
        <p className={`text-xs font-medium ${pointsLeft < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          Points remaining: {pointsLeft} / {POINT_BUY_BUDGET}
        </p>
      )}

      {/* Score inputs */}
      <div className="grid grid-cols-3 gap-3">
        {ABILITY_KEYS.map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{ABILITY_LABELS[key]}</Label>

            {method === 'standard' ? (
              <select
                value={scores[key]}
                onChange={(e) => setScore(key, Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value={scores[key]}>{scores[key]}</option>
                {STANDARD_ARRAY.filter((v) => !usedValues.includes(v) || v === scores[key]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : method === 'pointbuy' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScore(key, Math.max(8, scores[key] - 1))}
                  className="h-7 w-7 rounded border border-border text-muted-foreground hover:text-foreground flex items-center justify-center text-sm"
                >−</button>
                <span className="flex-1 text-center text-sm font-medium">{scores[key]}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = scores[key] + 1;
                    const addCost = (POINT_COST[next] ?? 99) - (POINT_COST[scores[key]] ?? 0);
                    if (next <= 15 && pointsLeft >= addCost) setScore(key, next);
                  }}
                  className="h-7 w-7 rounded border border-border text-muted-foreground hover:text-foreground flex items-center justify-center text-sm"
                >+</button>
              </div>
            ) : (
              <Input
                type="number"
                min={3}
                max={20}
                value={scores[key]}
                onChange={(e) => setScore(key, Math.min(20, Math.max(3, Number(e.target.value))))}
                className="h-8 text-sm text-center"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identity
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Selection state
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [selectedRaceName, setSelectedRaceName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedBackgroundId, setSelectedBackgroundId] = useState('');
  const [selectedBackgroundName, setSelectedBackgroundName] = useState('');

  // Ability scores
  const [abilityMethod, setAbilityMethod] = useState<AbilityScoreMethod>('standard');
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({
    str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8,
  });

  // Details
  const [backstory, setBackstory] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState('');
  const [ideals, setIdeals] = useState('');
  const [bonds, setBonds] = useState('');
  const [flaws, setFlaws] = useState('');

  // Form state
  const [nameError, setNameError] = useState<string | null>(null);

  // Homebrew queries
  const homebrewRaces = trpc.homebrew.getContent.useQuery({ type: 'race', limit: 50 });
  const homebrewClasses = trpc.homebrew.getContent.useQuery({ type: 'class', limit: 50 });
  const homebrewBackgrounds = trpc.homebrew.getContent.useQuery({ type: 'background', limit: 50 });

  const create = trpc.characters.create.useMutation({
    onSuccess: async (data) => {
      await utils.characters.getMyCharacters.invalidate();
      router.push(`/characters/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/character-portrait', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setPortraitUrl(data.url);
      else setUploadError(data.error ?? 'Upload failed');
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    create.mutate({
      name: name.trim(),
      race: selectedRaceName || undefined,
      class: selectedClassName || undefined,
      level,
      background: selectedBackgroundName || undefined,
      abilityScores,
      backstory: backstory || undefined,
      personalityTraits: personalityTraits || undefined,
      ideals: ideals || undefined,
      bonds: bonds || undefined,
      flaws: flaws || undefined,
      portraitUrl: portraitUrl || undefined,
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Character"
      preview={
        <CharacterPreview
          name={name}
          race={selectedRaceName}
          charClass={selectedClassName}
          level={level}
          background={selectedBackgroundName}
          backstory={backstory}
          portraitUrl={portraitUrl}
          uploading={uploading}
          onUploadClick={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl overflow-hidden">
          <Tabs defaultValue="details">
            <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10 grid grid-cols-5">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="race" className="text-xs">Race {selectedRaceName && '·'}</TabsTrigger>
              <TabsTrigger value="class" className="text-xs">Class {selectedClassName && '·'}</TabsTrigger>
              <TabsTrigger value="background" className="text-xs">Background {selectedBackgroundName && '·'}</TabsTrigger>
              <TabsTrigger value="scores" className="text-xs">Scores</TabsTrigger>
            </TabsList>

            {/* Details */}
            <TabsContent value="details" className="p-6 space-y-4 m-0">
              <div className="space-y-2">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="Tharivol Moonwhisper"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null); }}
                  aria-invalid={!!nameError}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Input
                  id="level"
                  type="number"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value))))}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backstory">Backstory</Label>
                <Textarea
                  id="backstory"
                  placeholder="Write your character's backstory…"
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="traits">Personality Traits</Label>
                  <Textarea id="traits" rows={2} className="resize-none" value={personalityTraits} onChange={(e) => setPersonalityTraits(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ideals">Ideals</Label>
                  <Textarea id="ideals" rows={2} className="resize-none" value={ideals} onChange={(e) => setIdeals(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonds">Bonds</Label>
                  <Textarea id="bonds" rows={2} className="resize-none" value={bonds} onChange={(e) => setBonds(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flaws">Flaws</Label>
                  <Textarea id="flaws" rows={2} className="resize-none" value={flaws} onChange={(e) => setFlaws(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* Race */}
            <TabsContent value="race" className="p-6 m-0">
              <RaceTab
                selectedRaceId={selectedRaceId}
                homebrewRaces={(homebrewRaces.data as any)?.items ?? []}
                onSelect={(race, name) => {
                  setSelectedRaceId(race?.id ?? name);
                  setSelectedRaceName(name);
                }}
              />
            </TabsContent>

            {/* Class */}
            <TabsContent value="class" className="p-6 m-0">
              <ClassTab
                selectedClassId={selectedClassId}
                homebrewClasses={(homebrewClasses.data as any)?.items ?? []}
                onSelect={(cls, name) => {
                  setSelectedClassId(cls?.id ?? name);
                  setSelectedClassName(name);
                }}
              />
            </TabsContent>

            {/* Background */}
            <TabsContent value="background" className="p-6 m-0">
              <BackgroundTab
                selectedBackgroundId={selectedBackgroundId}
                homebrewBackgrounds={(homebrewBackgrounds.data as any)?.items ?? []}
                onSelect={(bg, name) => {
                  setSelectedBackgroundId(bg?.id ?? name);
                  setSelectedBackgroundName(name);
                }}
              />
            </TabsContent>

            {/* Ability Scores */}
            <TabsContent value="scores" className="p-6 m-0">
              <AbilityScoresTab
                method={abilityMethod}
                onMethodChange={setAbilityMethod}
                scores={abilityScores}
                onScoresChange={setAbilityScores}
              />
            </TabsContent>
          </Tabs>

          {/* Submit row — always visible */}
          <div className="px-6 pb-6 pt-4 border-t border-border flex gap-3">
            {uploadError && <p className="text-xs text-destructive self-center">{uploadError}</p>}
            {create.error && (
              <p className="text-xs text-destructive self-center">{create.error.message}</p>
            )}
            <div className="flex gap-3 ml-auto">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Character'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            </div>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "characters/new"
```
Expected: no output

**Step 3: Verify homebrew query shape**

Check `src/server/routers/homebrew.ts` around `getContent` to confirm the response shape. The query returns `{ items: HomebrewContent[], nextCursor: string | null }` — we cast with `(data as any)?.items`. If the shape is different, adjust the cast in the JSX.

**Step 4: Commit**

```bash
git add src/app/\(app\)/characters/new/page.tsx
git commit -m "feat(ui): character builder with tabbed Race/Class/Background/Scores/Details form"
```

---

### Task 3: Push and verify

```bash
git push origin main
```

Navigate to `/characters/new` on the local dev server (`http://localhost:3847/characters/new`) and verify:
- 5 tabs render (Details, Race, Class, Background, Scores)
- Race grid shows 9 SRD races + any homebrew races from the library
- Selecting a race updates the preview subtitle live
- Class grid shows 12 SRD classes
- Background grid shows 13 SRD backgrounds
- Ability Scores tab: Standard Array dropdowns work (no duplicate values), Point Buy budget counter decrements correctly, Manual allows free entry
- Submit creates the character and redirects to the character detail page
