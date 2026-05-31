'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Swords, ChevronDown, ChevronRight } from 'lucide-react';

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const ABILITY_LABELS: Record<(typeof ABILITY_KEYS)[number], string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

export type AbilityScores = Record<(typeof ABILITY_KEYS)[number], string>;

export interface StatBlockFormState {
  cr: string;
  hp: string;
  ac: string;
  creatureType: string;
  size: string;
  speed: string;
  abilityScores: AbilityScores;
  actions: string;
  alignment: string;
  savingThrows: string;
  skills: string;
  senses: string;
  languages: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  damageVulnerabilities: string;
  traits: string;
  reactions: string;
  legendaryActions: string;
}

export const EMPTY_ABILITY_SCORES: AbilityScores = {
  str: '',
  dex: '',
  con: '',
  int: '',
  wis: '',
  cha: '',
};

export const EMPTY_STAT_BLOCK: StatBlockFormState = {
  cr: '',
  hp: '',
  ac: '',
  creatureType: '',
  size: '',
  speed: '',
  abilityScores: EMPTY_ABILITY_SCORES,
  actions: '',
  alignment: '',
  savingThrows: '',
  skills: '',
  senses: '',
  languages: '',
  damageResistances: '',
  damageImmunities: '',
  conditionImmunities: '',
  damageVulnerabilities: '',
  traits: '',
  reactions: '',
  legendaryActions: '',
};

function abilityModifier(score: string): string {
  const n = parseInt(score, 10);
  if (Number.isNaN(n)) return '';
  const mod = Math.floor((n - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function buildNpcStats(state: StatBlockFormState) {
  const hasAnyStatBlock =
    state.cr ||
    state.hp ||
    state.ac ||
    state.creatureType ||
    state.size ||
    state.speed ||
    state.actions ||
    state.alignment ||
    state.savingThrows ||
    state.skills ||
    state.senses ||
    state.languages ||
    state.damageResistances ||
    state.damageImmunities ||
    state.conditionImmunities ||
    state.damageVulnerabilities ||
    state.traits ||
    state.reactions ||
    state.legendaryActions ||
    ABILITY_KEYS.some((k) => state.abilityScores[k]);

  if (!hasAnyStatBlock) return undefined;

  const scores: Partial<Record<(typeof ABILITY_KEYS)[number], number>> = {};
  for (const k of ABILITY_KEYS) {
    const n = parseInt(state.abilityScores[k], 10);
    if (!Number.isNaN(n)) scores[k] = n;
  }

  return {
    cr: state.cr || undefined,
    hitPoints: state.hp ? parseInt(state.hp, 10) : undefined,
    armorClass: state.ac ? parseInt(state.ac, 10) : undefined,
    creatureType: state.creatureType || undefined,
    size: state.size || undefined,
    speed: state.speed || undefined,
    abilityScores: Object.keys(scores).length > 0 ? scores : undefined,
    actions: state.actions || undefined,
    alignment: state.alignment || undefined,
    savingThrows: state.savingThrows || undefined,
    skills: state.skills || undefined,
    senses: state.senses || undefined,
    languages: state.languages || undefined,
    damageResistances: state.damageResistances || undefined,
    damageImmunities: state.damageImmunities || undefined,
    conditionImmunities: state.conditionImmunities || undefined,
    damageVulnerabilities: state.damageVulnerabilities || undefined,
    traits: state.traits || undefined,
    reactions: state.reactions || undefined,
    legendaryActions: state.legendaryActions || undefined,
  };
}

export function hydrateStatBlock(stats: any): StatBlockFormState {
  if (!stats) {
    return {
      ...EMPTY_STAT_BLOCK,
      abilityScores: { ...EMPTY_ABILITY_SCORES },
    };
  }

  const abilityScores = stats.abilityScores ?? {};

  return {
    cr: stats.cr ?? '',
    hp:
      typeof stats.hitPoints === 'object'
        ? stats.hitPoints?.max != null
          ? String(stats.hitPoints.max)
          : ''
        : stats.hitPoints != null
          ? String(stats.hitPoints)
          : '',
    ac: stats.armorClass != null ? String(stats.armorClass) : '',
    creatureType: stats.creatureType ?? '',
    size: stats.size ?? '',
    speed: stats.speed ?? '',
    abilityScores: {
      str: abilityScores.str != null ? String(abilityScores.str) : '',
      dex: abilityScores.dex != null ? String(abilityScores.dex) : '',
      con: abilityScores.con != null ? String(abilityScores.con) : '',
      int: abilityScores.int != null ? String(abilityScores.int) : '',
      wis: abilityScores.wis != null ? String(abilityScores.wis) : '',
      cha: abilityScores.cha != null ? String(abilityScores.cha) : '',
    },
    actions: stats.actions ?? '',
    alignment: stats.alignment ?? '',
    savingThrows: stats.savingThrows ?? '',
    skills: stats.skills ?? '',
    senses: stats.senses ?? '',
    languages: stats.languages ?? '',
    damageResistances: stats.damageResistances ?? '',
    damageImmunities: stats.damageImmunities ?? '',
    conditionImmunities: stats.conditionImmunities ?? '',
    damageVulnerabilities: stats.damageVulnerabilities ?? '',
    traits: stats.traits ?? '',
    reactions: stats.reactions ?? '',
    legendaryActions: stats.legendaryActions ?? '',
  };
}

interface NpcPreviewProps {
  name: string;
  faction: string;
  description: string;
  imageUrl: string;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function NpcPreview({
  name,
  faction,
  description,
  imageUrl,
  uploading,
  onFileChange,
  onDrop,
  fileInputRef,
}: NpcPreviewProps) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <label
        className="block relative h-24 w-full cursor-pointer group"
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {imageUrl ? (
          <Image src={imageUrl} alt="NPC portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            <div className="text-center opacity-40 group-hover:opacity-100 transition-opacity">
              <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground/60 mt-1">Upload image</p>
            </div>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 transition-all rounded-t-xl pointer-events-none" />
      </label>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || <span className="text-muted-foreground/40">NPC Name</span>}
          </h3>
          {faction && (
            <Badge variant="outline" className="text-xs shrink-0">
              {faction}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || <span className="opacity-40">No description</span>}
        </p>
      </div>
    </div>
  );
}

interface StatBlockSectionProps {
  state: StatBlockFormState;
  setField: <K extends Exclude<keyof StatBlockFormState, 'abilityScores'>>(key: K, value: StatBlockFormState[K]) => void;
  setAbilityScore: (key: (typeof ABILITY_KEYS)[number], val: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StatBlockSection({ state, setField, setAbilityScore, open, onOpenChange }: StatBlockSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;

  function updateOpen(next: boolean) {
    if (isControlled) {
      onOpenChange?.(next);
      return;
    }
    setInternalOpen(next);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => updateOpen(!isOpen)}
      >
        <Swords className="h-3 w-3 text-muted-foreground" />
        <p className="label-overline mb-0">D&amp;D 5e Stat Block</p>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
        )}
      </button>
      <div className="section-rule" />
      {isOpen && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="creatureType">Creature Type</Label>
              <Input
                id="creatureType"
                placeholder="Humanoid, Undead, Dragon..."
                value={state.creatureType}
                onChange={(e) => setField('creatureType', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <select
                id="size"
                value={state.size}
                onChange={(e) => setField('size', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select size</option>
                <option value="Tiny">Tiny</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
                <option value="Huge">Huge</option>
                <option value="Gargantuan">Gargantuan</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr">Challenge Rating (CR)</Label>
              <Input
                id="cr"
                placeholder="1/4, 1, 5, 20..."
                value={state.cr}
                onChange={(e) => setField('cr', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hp">Hit Points</Label>
              <Input
                id="hp"
                type="number"
                min={0}
                placeholder="45"
                value={state.hp}
                onChange={(e) => setField('hp', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac">Armor Class</Label>
              <Input
                id="ac"
                type="number"
                min={0}
                placeholder="13"
                value={state.ac}
                onChange={(e) => setField('ac', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speed">Speed</Label>
              <Input
                id="speed"
                placeholder="30 ft."
                value={state.speed}
                onChange={(e) => setField('speed', e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-3">Ability Scores</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {ABILITY_KEYS.map((key) => (
                <div key={key} className="space-y-1 text-center">
                  <Label htmlFor={`ability-${key}`} className="text-xs font-semibold">
                    {ABILITY_LABELS[key]}
                  </Label>
                  <Input
                    id={`ability-${key}`}
                    type="number"
                    min={1}
                    max={30}
                    placeholder="10"
                    value={state.abilityScores[key]}
                    onChange={(e) => setAbilityScore(key, e.target.value)}
                    className="text-center px-1"
                  />
                  <p className="text-xs text-muted-foreground h-4">{abilityModifier(state.abilityScores[key])}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alignment">Alignment</Label>
            <Input
              id="alignment"
              placeholder="Neutral Evil"
              value={state.alignment}
              onChange={(e) => setField('alignment', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="savingThrows">Saving Throws</Label>
              <Input
                id="savingThrows"
                placeholder="Dex +5, Wis +3"
                value={state.savingThrows}
                onChange={(e) => setField('savingThrows', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                placeholder="Perception +5, Stealth +7"
                value={state.skills}
                onChange={(e) => setField('skills', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senses">Senses</Label>
              <Input
                id="senses"
                placeholder="Darkvision 60 ft., passive Perception 15"
                value={state.senses}
                onChange={(e) => setField('senses', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages">Languages</Label>
              <Input
                id="languages"
                placeholder="Common, Elvish"
                value={state.languages}
                onChange={(e) => setField('languages', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="damageResistances">Damage Resistances</Label>
              <Input
                id="damageResistances"
                placeholder="Cold, Fire, Lightning"
                value={state.damageResistances}
                onChange={(e) => setField('damageResistances', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="damageImmunities">Damage Immunities</Label>
              <Input
                id="damageImmunities"
                placeholder="Poison, Psychic"
                value={state.damageImmunities}
                onChange={(e) => setField('damageImmunities', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="conditionImmunities">Condition Immunities</Label>
              <Input
                id="conditionImmunities"
                placeholder="Charmed, Frightened, Poisoned"
                value={state.conditionImmunities}
                onChange={(e) => setField('conditionImmunities', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="damageVulnerabilities">Damage Vulnerabilities</Label>
              <Input
                id="damageVulnerabilities"
                placeholder="Fire, Radiant"
                value={state.damageVulnerabilities}
                onChange={(e) => setField('damageVulnerabilities', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="traits">Traits / Special Abilities</Label>
            <Textarea
              id="traits"
              placeholder="Spellcasting. The mage is a 9th-level spellcaster..."
              value={state.traits}
              onChange={(e) => setField('traits', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reactions">Reactions</Label>
            <Textarea
              id="reactions"
              placeholder="Parry. The knight adds 2 to its AC against one melee attack..."
              value={state.reactions}
              onChange={(e) => setField('reactions', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legendaryActions">Legendary Actions</Label>
            <Textarea
              id="legendaryActions"
              placeholder="3 legendary actions. Can only be used at the end of another creature's turn..."
              value={state.legendaryActions}
              onChange={(e) => setField('legendaryActions', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actions">Actions</Label>
            <Textarea
              id="actions"
              placeholder="Multiattack. The creature makes two attacks..."
              value={state.actions}
              onChange={(e) => setField('actions', e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
