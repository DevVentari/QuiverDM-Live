'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Lock, ChevronDown, ChevronRight, Swords } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS: Record<typeof ABILITY_KEYS[number], string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

type AbilityScores = Record<typeof ABILITY_KEYS[number], string>;

function abilityModifier(score: string): string {
  const n = parseInt(score, 10);
  if (isNaN(n)) return '';
  const mod = Math.floor((n - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

interface StatBlockSectionProps {
  cr: string; setCr: (v: string) => void;
  hp: string; setHp: (v: string) => void;
  ac: string; setAc: (v: string) => void;
  creatureType: string; setCreatureType: (v: string) => void;
  speed: string; setSpeed: (v: string) => void;
  abilityScores: AbilityScores; setAbilityScore: (key: typeof ABILITY_KEYS[number], val: string) => void;
  actions: string; setActions: (v: string) => void;
  alignment: string; setAlignment: (v: string) => void;
  savingThrows: string; setSavingThrows: (v: string) => void;
  skills: string; setSkills: (v: string) => void;
  senses: string; setSenses: (v: string) => void;
  languages: string; setLanguages: (v: string) => void;
  damageResistances: string; setDamageResistances: (v: string) => void;
  damageImmunities: string; setDamageImmunities: (v: string) => void;
}

function StatBlockSection({
  cr, setCr, hp, setHp, ac, setAc,
  creatureType, setCreatureType, speed, setSpeed,
  abilityScores, setAbilityScore, actions, setActions,
  alignment, setAlignment, savingThrows, setSavingThrows,
  skills, setSkills, senses, setSenses, languages, setLanguages,
  damageResistances, setDamageResistances, damageImmunities, setDamageImmunities,
}: StatBlockSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Swords className="h-3 w-3 text-muted-foreground" />
        <p className="label-overline mb-0">D&D 5e Stat Block</p>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
        )}
      </button>
      <div className="section-rule" />
      {open && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="creatureType">Creature Type</Label>
              <Input
                id="creatureType"
                placeholder="Humanoid, Undead, Dragon..."
                value={creatureType}
                onChange={(e) => setCreatureType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr">Challenge Rating (CR)</Label>
              <Input
                id="cr"
                placeholder="1/4, 1, 5, 20..."
                value={cr}
                onChange={(e) => setCr(e.target.value)}
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
                value={hp}
                onChange={(e) => setHp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac">Armor Class</Label>
              <Input
                id="ac"
                type="number"
                min={0}
                placeholder="13"
                value={ac}
                onChange={(e) => setAc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speed">Speed</Label>
              <Input
                id="speed"
                placeholder="30 ft."
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
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
                    value={abilityScores[key]}
                    onChange={(e) => setAbilityScore(key, e.target.value)}
                    className="text-center px-1"
                  />
                  <p className="text-xs text-muted-foreground h-4">
                    {abilityModifier(abilityScores[key])}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alignment">Alignment</Label>
            <Input
              id="alignment"
              placeholder="Neutral Evil"
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="savingThrows">Saving Throws</Label>
              <Input
                id="savingThrows"
                placeholder="Dex +5, Wis +3"
                value={savingThrows}
                onChange={(e) => setSavingThrows(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                placeholder="Perception +5, Stealth +7"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senses">Senses</Label>
              <Input
                id="senses"
                placeholder="Darkvision 60 ft., passive Perception 15"
                value={senses}
                onChange={(e) => setSenses(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages">Languages</Label>
              <Input
                id="languages"
                placeholder="Common, Elvish"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="damageResistances">Damage Resistances</Label>
              <Input
                id="damageResistances"
                placeholder="Cold, Fire, Lightning"
                value={damageResistances}
                onChange={(e) => setDamageResistances(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="damageImmunities">Damage Immunities</Label>
              <Input
                id="damageImmunities"
                placeholder="Poison, Psychic"
                value={damageImmunities}
                onChange={(e) => setDamageImmunities(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actions">Actions</Label>
            <Textarea
              id="actions"
              placeholder="Multiattack. The creature makes two attacks...&#10;&#10;Longsword. Melee Weapon Attack: +5 to hit..."
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface NpcPreviewProps {
  name: string;
  faction: string;
  description: string;
  imageUrl: string;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function NpcPreview({
  name, faction, description, imageUrl,
  uploading, onFileChange, onDrop, fileInputRef,
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
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {imageUrl ? (
          <Image src={imageUrl} alt="NPC portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
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
            <Badge variant="outline" className="text-xs shrink-0">{faction}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || <span className="opacity-40">No description</span>}
        </p>
      </div>
    </div>
  );
}

export default function NewNPCPage() {
  const router = useRouter();
  const { campaignId, slug } = useCampaign();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [faction, setFaction] = useState('');
  const [description, setDescription] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [cr, setCr] = useState('');
  const [hp, setHp] = useState('');
  const [ac, setAc] = useState('');
  const [creatureType, setCreatureType] = useState('');
  const [speed, setSpeed] = useState('');
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
  });
  const [actions, setActions] = useState('');
  const [alignment, setAlignment] = useState('');
  const [savingThrows, setSavingThrows] = useState('');
  const [skills, setSkills] = useState('');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [damageResistances, setDamageResistances] = useState('');
  const [damageImmunities, setDamageImmunities] = useState('');

  function setAbilityScore(key: typeof ABILITY_KEYS[number], val: string) {
    setAbilityScores((prev) => ({ ...prev, [key]: val }));
  }

  function buildStats() {
    const hasAnyStatBlock = cr || hp || ac || creatureType || speed || actions ||
      alignment || savingThrows || skills || senses || languages || damageResistances || damageImmunities ||
      ABILITY_KEYS.some((k) => abilityScores[k]);
    if (!hasAnyStatBlock) return undefined;
    const scores: Partial<Record<typeof ABILITY_KEYS[number], number>> = {};
    for (const k of ABILITY_KEYS) {
      const n = parseInt(abilityScores[k], 10);
      if (!isNaN(n)) scores[k] = n;
    }
    return {
      cr: cr || undefined,
      hitPoints: hp ? parseInt(hp, 10) : undefined,
      armorClass: ac ? parseInt(ac, 10) : undefined,
      creatureType: creatureType || undefined,
      speed: speed || undefined,
      abilityScores: Object.keys(scores).length > 0 ? scores : undefined,
      actions: actions || undefined,
      alignment: alignment || undefined,
      savingThrows: savingThrows || undefined,
      skills: skills || undefined,
      senses: senses || undefined,
      languages: languages || undefined,
      damageResistances: damageResistances || undefined,
      damageImmunities: damageImmunities || undefined,
    };
  }

  const utils = trpc.useUtils();

  const create = trpc.npcs.create.useMutation({
    onSuccess: (data) => {
      utils.npcs.getAll.invalidate({ campaignId });
      router.push(`/campaigns/${slug}/npcs/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);
      const res = await fetch('/api/upload/npc-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
      } else {
        setUploadError(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    create.mutate({
      campaignId,
      name,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
      stats: buildStats(),
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New NPC"
      preview={
        <NpcPreview
          name={name}
          faction={faction}
          description={description}
          imageUrl={imageUrl}
          uploading={uploading}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Identity */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Identity</p>
              <div className="section-rule" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Strahd von Zarovich"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null); }}
                  aria-invalid={!!nameError}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="faction">Faction</Label>
                <Input
                  id="faction"
                  placeholder="Castle Ravenloft"
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Details</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A pale figure with piercing eyes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          {/* DM Only */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1 flex items-center gap-1.5">
                <Lock className="h-2.5 w-2.5" />
                DM Only
              </p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secrets">Secrets</Label>
              <Textarea
                id="secrets"
                placeholder="Hidden motivations, secret weaknesses..."
                value={secrets}
                onChange={(e) => setSecrets(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Stat Block */}
          <StatBlockSection
            cr={cr} setCr={setCr}
            hp={hp} setHp={setHp}
            ac={ac} setAc={setAc}
            creatureType={creatureType} setCreatureType={setCreatureType}
            speed={speed} setSpeed={setSpeed}
            abilityScores={abilityScores} setAbilityScore={setAbilityScore}
            actions={actions} setActions={setActions}
            alignment={alignment} setAlignment={setAlignment}
            savingThrows={savingThrows} setSavingThrows={setSavingThrows}
            skills={skills} setSkills={setSkills}
            senses={senses} setSenses={setSenses}
            languages={languages} setLanguages={setLanguages}
            damageResistances={damageResistances} setDamageResistances={setDamageResistances}
            damageImmunities={damageImmunities} setDamageImmunities={setDamageImmunities}
          />

          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create NPC'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
