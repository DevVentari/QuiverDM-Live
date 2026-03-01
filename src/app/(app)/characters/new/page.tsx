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
  const usedValues = Object.values(scores) as number[];

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
                onSelect={(race, raceName) => {
                  setSelectedRaceId(race?.id ?? raceName);
                  setSelectedRaceName(raceName);
                }}
              />
            </TabsContent>

            {/* Class */}
            <TabsContent value="class" className="p-6 m-0">
              <ClassTab
                selectedClassId={selectedClassId}
                homebrewClasses={(homebrewClasses.data as any)?.items ?? []}
                onSelect={(cls, clsName) => {
                  setSelectedClassId(cls?.id ?? clsName);
                  setSelectedClassName(clsName);
                }}
              />
            </TabsContent>

            {/* Background */}
            <TabsContent value="background" className="p-6 m-0">
              <BackgroundTab
                selectedBackgroundId={selectedBackgroundId}
                homebrewBackgrounds={(homebrewBackgrounds.data as any)?.items ?? []}
                onSelect={(bg, bgName) => {
                  setSelectedBackgroundId(bg?.id ?? bgName);
                  setSelectedBackgroundName(bgName);
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
