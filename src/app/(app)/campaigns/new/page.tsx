'use client';

import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { useState, useRef } from 'react';
import { z } from 'zod';
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
import { ChevronDown, Upload, Loader2, Link, Trash2, Plus, X } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';
import { cn } from '@/lib/utils';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name must be 100 characters or less'),
});

function CampaignPreview({ name, description, bannerUrl }: { name: string; description: string; bannerUrl: string | null }) {
  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      {bannerUrl ? (
        <img src={bannerUrl} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold truncate">
            {name || <span className="text-muted-foreground/40">Your Campaign</span>}
          </h3>
          <Badge variant="outline" className="text-xs shrink-0 text-slate-400 border-slate-500/30 bg-slate-500/10">
            Draft
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description || <span className="opacity-40">No description</span>}
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gameSystem, setGameSystem] = useState('');
  const [settingName, setSettingName] = useState('');
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [startingLevel, setStartingLevel] = useState<number | undefined>(undefined);
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('');
  const [houseRules, setHouseRules] = useState('');

  // Tone & Themes
  const [themes, setThemes] = useState<string[]>([]);

  // Players
  const [players, setPlayers] = useState<Array<{ name: string; characterName: string }>>([
    { name: '', characterName: '' },
  ]);

  // World Setup
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [antagonistMotivation, setAntagonistMotivation] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [factions, setFactions] = useState<Array<{ name: string; stance: 'ally' | 'neutral' | 'hostile' }>>([
    { name: '', stance: 'neutral' },
  ]);

  // Story So Far
  const [storyText, setStoryText] = useState('');

  // Import Documents
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const create = trpc.campaigns.create.useMutation({
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
  const createPDF = trpc.homebrewPdf.createPDF.useMutation();
  const seedFromCreation = trpc.brain.seedFromCreation.useMutation();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = createCampaignSchema.safeParse({ name: name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const validPlayers = players.filter(
      (p) => p.name.trim() !== '' || p.characterName.trim() !== ''
    );

    let campaign: { id: string; slug: string };
    try {
      campaign = await create.mutateAsync({
        name: name.trim(),
        description: description || undefined,
        bannerUrl: bannerUrl || undefined,
        settings: {
          themes: themes.length > 0 ? themes : undefined,
          ...(showAdvanced && {
            gameSystem: gameSystem || undefined,
            settingName: settingName || undefined,
            playerCount: playerCount || undefined,
            startingLevel: startingLevel || undefined,
            schedule: (scheduleDay || scheduleTime || scheduleFrequency) ? {
              day: scheduleDay || undefined,
              time: scheduleTime || undefined,
              frequency: scheduleFrequency || undefined,
            } : undefined,
            houseRules: houseRules || undefined,
          }),
        },
        players: validPlayers.length > 0 ? validPlayers : undefined,
      });
    } catch {
      return;
    }

    if (docFiles.length > 0) {
      setDocUploading(true);
      await Promise.allSettled(docFiles.map(async (file) => {
        try {
          const { presignedUrl, r2Key, r2Url } = await getUploadUrl.mutateAsync({
            filename: file.name,
            fileSize: file.size,
            campaignId: campaign.id,
          });
          if (!presignedUrl || !r2Key || !r2Url) {
            console.warn('[campaign-create] R2 not configured, skipping doc upload for', file.name);
            return;
          }
          await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
          await createPDF.mutateAsync({
            filename: file.name,
            fileSize: file.size,
            mimeType: 'application/pdf',
            r2Url,
            r2Key,
            campaignId: campaign.id,
          });
        } catch (err) {
          console.error('[campaign-create] Doc upload failed for', file.name, err);
          toast({ title: `Upload failed: ${file.name}`, variant: 'destructive' });
        }
      }));
      setDocUploading(false);
    }

    const hasWorldData = antagonistName.trim() !== '' || startingLocation.trim() !== '' ||
      openingHook.trim() !== '' || storyText.trim() !== '' ||
      factions.some((f) => f.name.trim() !== '');

    if (hasWorldData) {
      try {
        await seedFromCreation.mutateAsync({
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
      } catch {
        toast({ title: 'Brain seeding failed', description: 'You can seed from the Brain page later.', variant: 'destructive' });
      }
    }

    router.push(`/campaigns/${campaign.slug || campaign.id}`);
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Campaign"
      preview={<CampaignPreview name={name} description={description} bannerUrl={bannerUrl} />}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
        }}
      >
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Banner Upload */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Banner Image</p>
              <div className="section-rule" />
            </div>
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
                <img src={bannerUrl} alt="Campaign banner" className="h-32 w-full object-cover rounded-lg" />
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex flex-col items-center justify-center gap-2">
                  {uploadingBanner ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground/50">Drop an image or click to upload</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Campaign Identity */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Campaign Identity</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Curse of Strahd"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors({}); }}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A Gothic horror adventure in the mists of Barovia..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          {/* Tone & Themes */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Tone & Themes</p>
              <div className="section-rule" />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Horror', 'Political Intrigue', 'Dungeon Crawl', 'Maritime', 'Exploration', 'Mystery', 'War', 'Cosmic'].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setThemes((prev) =>
                    prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
                  )}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    themes.includes(theme)
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Players */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Players</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              {players.map((player, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    placeholder="Player name"
                    value={player.name}
                    maxLength={100}
                    onChange={(e) => setPlayers((prev) => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                  />
                  <Input
                    placeholder="Character name"
                    value={player.characterName}
                    maxLength={100}
                    onChange={(e) => setPlayers((prev) => prev.map((p, i) => i === idx ? { ...p, characterName: e.target.value } : p))}
                  />
                  <button
                    type="button"
                    onClick={() => setPlayers((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove player"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPlayers((prev) => [...prev, { name: '', characterName: '' }])}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add player
            </button>
          </div>

          {/* World Setup */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">World Setup</p>
              <div className="section-rule" />
            </div>
            <div className="rounded-lg border border-border/40 bg-stone-900/40 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startingLocation">Starting Location</Label>
                  <Input id="startingLocation" placeholder="Waterdeep" value={startingLocation} maxLength={200}
                    onChange={(e) => setStartingLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="antagonistName">Main Antagonist</Label>
                  <Input id="antagonistName" placeholder="Strahd von Zarovich" value={antagonistName} maxLength={200}
                    onChange={(e) => setAntagonistName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="antagonistMotivation">Antagonist Motivation</Label>
                <Input id="antagonistMotivation" placeholder="Seeks to break an ancient curse..." value={antagonistMotivation} maxLength={200}
                  onChange={(e) => setAntagonistMotivation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingHook">Opening Hook</Label>
                <Input id="openingHook" placeholder="A merchant is found dead with a strange symbol..." value={openingHook} maxLength={200}
                  onChange={(e) => setOpeningHook(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Key Factions</Label>
                <div className="space-y-2">
                  {factions.map((faction, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                      <Input placeholder="Faction name" value={faction.name} maxLength={100}
                        onChange={(e) => setFactions((prev) => prev.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))} />
                      <Select value={faction.stance} onValueChange={(v) => setFactions((prev) => prev.map((f, i) => i === idx ? { ...f, stance: v as 'ally' | 'neutral' | 'hostile' } : f))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ally">Ally</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="hostile">Hostile</SelectItem>
                        </SelectContent>
                      </Select>
                      <button type="button" onClick={() => setFactions((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {factions.length < 3 && (
                  <button type="button" onClick={() => setFactions((prev) => [...prev, { name: '', stance: 'neutral' }])}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add faction
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Story So Far */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Story So Far</p>
              <div className="section-rule" />
            </div>
            <Textarea
              placeholder="Migrating from another platform? Paste your campaign history here."
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              maxLength={20000}
              rows={5}
              className="resize-none"
            />
            {storyText.length > 0 && (
              <p className="text-xs text-muted-foreground">{storyText.length.toLocaleString()} / 20,000 characters</p>
            )}
          </div>

          {/* Import Documents */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Import Documents</p>
              <div className="section-rule" />
            </div>
            <div
              className={cn(
                'relative rounded-lg border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors cursor-pointer',
                docUploading && 'pointer-events-none opacity-60'
              )}
              onClick={() => docInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
                setDocFiles((prev) => [...prev, ...files].slice(0, 10));
              }}
            >
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setDocFiles((prev) => [...prev, ...files].slice(0, 10));
                }}
              />
              <div className="h-20 flex flex-col items-center justify-center gap-1.5">
                <Upload className="h-5 w-5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground/50">Drop session notes, module PDFs, or world documents</p>
                <p className="text-xs text-muted-foreground/30">PDF only · max 10 files · 50MB each</p>
              </div>
            </div>
            {docFiles.length > 0 && (
              <ul className="space-y-1">
                {docFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setDocFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Advanced Settings Toggle */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-1">
                <div>
                  <div className="section-rule" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gameSystem">Game System</Label>
                    <Select value={gameSystem} onValueChange={setGameSystem}>
                      <SelectTrigger id="gameSystem">
                        <SelectValue placeholder="Select system" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dnd5e">D&D 5e</SelectItem>
                        <SelectItem value="pf2e">Pathfinder 2e</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settingName">Setting / World Name</Label>
                    <Input
                      id="settingName"
                      placeholder="The Forgotten Realms"
                      value={settingName}
                      onChange={(e) => setSettingName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playerCount">Player Count</Label>
                    <Input
                      id="playerCount"
                      type="number"
                      min={1}
                      max={20}
                      placeholder="4"
                      value={playerCount ?? ''}
                      onChange={(e) => setPlayerCount(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startingLevel">Starting Level</Label>
                    <Input
                      id="startingLevel"
                      type="number"
                      min={1}
                      max={20}
                      placeholder="1"
                      value={startingLevel ?? ''}
                      onChange={(e) => setStartingLevel(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Session Schedule</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Select value={scheduleDay} onValueChange={setScheduleDay}>
                      <SelectTrigger>
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                    <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="irregular">Irregular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="houseRules">House Rules</Label>
                  <Textarea
                    id="houseRules"
                    placeholder="Critical hits deal max damage + roll, flanking gives +2..."
                    value={houseRules}
                    onChange={(e) => setHouseRules(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <NextLink
                  href="/campaigns/new/import-obsidian"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Link className="h-3.5 w-3.5" />
                  Or import from an Obsidian vault
                </NextLink>
              </div>
            )}
          </div>

          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="default" disabled={create.isPending || docUploading || seedFromCreation.isPending}>
              {(create.isPending || docUploading || seedFromCreation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create Campaign'
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
