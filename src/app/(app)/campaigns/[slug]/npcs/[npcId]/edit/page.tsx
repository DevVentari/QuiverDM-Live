'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, ChevronDown, ChevronRight, Swords } from 'lucide-react';
import Link from 'next/link';

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

export default function EditNPCPage() {
  const params = useParams();
  const npcId = params.npcId as string;
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [statBlockOpen, setStatBlockOpen] = useState(false);
  const [cr, setCr] = useState('');
  const [hp, setHp] = useState('');
  const [ac, setAc] = useState('');
  const [creatureType, setCreatureType] = useState('');
  const [size, setSize] = useState('');
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
  const [conditionImmunities, setConditionImmunities] = useState('');
  const [damageVulnerabilities, setDamageVulnerabilities] = useState('');
  const [traits, setTraits] = useState('');
  const [reactions, setReactions] = useState('');
  const [legendaryActions, setLegendaryActions] = useState('');

  function setAbilityScore(key: typeof ABILITY_KEYS[number], val: string) {
    setAbilityScores((prev) => ({ ...prev, [key]: val }));
  }

  function buildStats() {
    const hasAnyStatBlock = cr || hp || ac || creatureType || size || speed || actions ||
      alignment || savingThrows || skills || senses || languages || damageResistances || damageImmunities ||
      conditionImmunities || damageVulnerabilities || traits || reactions || legendaryActions ||
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
      size: size || undefined,
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
      conditionImmunities: conditionImmunities || undefined,
      damageVulnerabilities: damageVulnerabilities || undefined,
      traits: traits || undefined,
      reactions: reactions || undefined,
      legendaryActions: legendaryActions || undefined,
    };
  }

  useEffect(() => {
    if (!npc.data) return;
    const data = npc.data as any;
    setName(data.name || '');
    setDescription(data.description || '');
    setFaction(data.faction || '');
    setSecrets(data.secrets || '');
    setImageUrl(data.imageUrl || '');
    const s = data.stats as any;
    if (s) {
      setStatBlockOpen(true);
      setCr(s.cr ?? '');
      setHp(s.hitPoints != null ? String(s.hitPoints) : '');
      setAc(s.armorClass != null ? String(s.armorClass) : '');
      setCreatureType(s.creatureType ?? '');
      setSpeed(s.speed ?? '');
      setActions(s.actions ?? '');
      setAlignment(s.alignment ?? '');
      setSavingThrows(s.savingThrows ?? '');
      setSkills(s.skills ?? '');
      setSenses(s.senses ?? '');
      setLanguages(s.languages ?? '');
      setDamageResistances(s.damageResistances ?? '');
      setDamageImmunities(s.damageImmunities ?? '');
      setConditionImmunities(s.conditionImmunities ?? '');
      setDamageVulnerabilities(s.damageVulnerabilities ?? '');
      setSize(s.size ?? '');
      setTraits(s.traits ?? '');
      setReactions(s.reactions ?? '');
      setLegendaryActions(s.legendaryActions ?? '');
      const ab = s.abilityScores ?? {};
      setAbilityScores({
        str: ab.str != null ? String(ab.str) : '',
        dex: ab.dex != null ? String(ab.dex) : '',
        con: ab.con != null ? String(ab.con) : '',
        int: ab.int != null ? String(ab.int) : '',
        wis: ab.wis != null ? String(ab.wis) : '',
        cha: ab.cha != null ? String(ab.cha) : '',
      });
    }
  }, [npc.data]);

  const update = trpc.npcs.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'NPC updated',
        description: 'Changes saved successfully.',
      });
      router.push(`/campaigns/${slug}/npcs/${npcId}`);
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);

      const res = await fetch('/api/upload/npc-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: 'Could not upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    update.mutate({
      id: npcId,
      name: name || undefined,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
      stats: buildStats(),
    });
  }

  if (!isDM) {
    return <p className="text-destructive">Only DMs can edit NPCs.</p>;
  }

  if (npc.isLoading) {
    return <Skeleton className="h-96 rounded-lg max-w-4xl" />;
  }

  if (!npc.data) {
    return <p className="text-destructive">NPC not found</p>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/campaigns/${slug}/npcs/${npcId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="label-overline mb-0.5">NPC</p>
          <h1 className="text-xl font-display font-bold tracking-wide">Edit NPC</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Two-column grid on desktop */}
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">

          {/* Left column — Identity */}
          <div className="stone-card">
            <div className="stone-card-header">
              <h2 className="stone-card-title">Identity</h2>
            </div>
            <div className="stone-card-body space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setNameError(null); }}
                    aria-invalid={!!nameError}
                  />
                  {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faction">Faction</Label>
                  <Input
                    id="faction"
                    value={faction}
                    onChange={(e) => setFaction(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  {imageUrl && (
                    <Image src={imageUrl} alt={name ? `${name} portrait preview` : 'NPC portrait preview'} width={48} height={48} className="rounded object-cover" unoptimized />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right column — two stacked cards */}
          <div className="space-y-6">
            {/* DM Secrets card */}
            <div className="stone-card">
              <div className="stone-card-header">
                <h2 className="stone-card-title">DM Secrets</h2>
              </div>
              <div className="stone-card-body">
                <div className="space-y-2">
                  <Label htmlFor="secrets">Secrets</Label>
                  <Textarea
                    id="secrets"
                    value={secrets}
                    onChange={(e) => setSecrets(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* D&D 5e Stat Block card */}
            <div className="stone-card">
              <div
                className="stone-card-header cursor-pointer w-full flex items-center justify-between"
                onClick={() => setStatBlockOpen((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStatBlockOpen((v) => !v); }}
                aria-expanded={statBlockOpen}
              >
                <div className="flex items-center gap-2">
                  <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="stone-card-title">D&amp;D 5e Stat Block</h2>
                </div>
                {statBlockOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              {statBlockOpen && (
                <div className="stone-card-body space-y-4">
                  <div className="section-rule" />
                  <div className="grid gap-4 sm:grid-cols-3">
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
                      <Label htmlFor="size">Size</Label>
                      <select
                        id="size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">— Select size —</option>
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="conditionImmunities">Condition Immunities</Label>
                      <Input
                        id="conditionImmunities"
                        placeholder="Charmed, Frightened, Poisoned"
                        value={conditionImmunities}
                        onChange={(e) => setConditionImmunities(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="damageVulnerabilities">Damage Vulnerabilities</Label>
                      <Input
                        id="damageVulnerabilities"
                        placeholder="Fire, Radiant"
                        value={damageVulnerabilities}
                        onChange={(e) => setDamageVulnerabilities(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="traits">Traits / Special Abilities</Label>
                    <Textarea
                      id="traits"
                      placeholder="Spellcasting. The mage is a 9th-level spellcaster..."
                      value={traits}
                      onChange={(e) => setTraits(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reactions">Reactions</Label>
                    <Textarea
                      id="reactions"
                      placeholder="Parry. The knight adds 2 to its AC against one melee attack..."
                      value={reactions}
                      onChange={(e) => setReactions(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legendaryActions">Legendary Actions</Label>
                    <Textarea
                      id="legendaryActions"
                      placeholder="3 legendary actions. Can only be used at the end of another creature's turn..."
                      value={legendaryActions}
                      onChange={(e) => setLegendaryActions(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actions">Actions</Label>
                    <Textarea
                      id="actions"
                      placeholder="Multiattack. The creature makes two attacks..."
                      value={actions}
                      onChange={(e) => setActions(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit / Cancel — below the two-column grid, left-aligned */}
        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={update.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
