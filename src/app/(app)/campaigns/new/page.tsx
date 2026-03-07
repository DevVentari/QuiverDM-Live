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
import { ChevronDown, Upload, Loader2, Link } from 'lucide-react';
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

  const create = trpc.campaigns.create.useMutation({
    onSuccess: (campaign) => {
      router.push(`/campaigns/${campaign.slug || campaign.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

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

  function handleSubmit(e: React.FormEvent) {
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
    create.mutate({
      name: name.trim(),
      description: description || undefined,
      bannerUrl: bannerUrl || undefined,
      settings: showAdvanced ? {
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
      } : undefined,
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Campaign"
      preview={<CampaignPreview name={name} description={description} bannerUrl={bannerUrl} />}
    >
      <form onSubmit={handleSubmit}>
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
            <Button type="submit" variant="default" disabled={create.isPending}>
              {create.isPending ? (
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
