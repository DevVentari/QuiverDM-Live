'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { WebhookSettings } from '@/components/campaign/webhook-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function CampaignSettingsPage() {
  const router = useRouter();
  const { campaignId, isOwner, isDM } = useCampaign();
  const { toast } = useToast();
  const campaign = trpc.campaigns.getById.useQuery({ id: campaignId }, { staleTime: 120_000 });
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [latestApiKey, setLatestApiKey] = useState<string | null>(null);
  const [sourcebook, setSourcebook] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const foundryEnabled = process.env.NEXT_PUBLIC_FOUNDRY_BRIDGE_ENABLED === 'true';
  const importJobsQuery = (trpc as any).foundry.getImportJobs.useQuery(
    { campaignId },
    { enabled: isDM && foundryEnabled }
  );

  useEffect(() => {
    if (campaign.data) {
      const data = campaign.data as any;
      setName(data.name || '');
      setDescription(data.description || '');
      setStatus(data.status || 'active');
      setBannerUrl(data.bannerUrl ?? null);
      const settings = (data.settings ?? {}) as Record<string, unknown>;
      setSourcebook((settings.sourcebook as string) || '');
      setDiscordWebhookUrl((settings.discordWebhookUrl as string) || '');
    }
  }, [campaign.data]);

  const update = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      utils.campaigns.getBySlug.invalidate();
      utils.campaigns.getById.invalidate({ id: campaignId });
      toast({ title: 'Settings saved', description: 'Campaign settings updated successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => router.push('/campaigns'),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateSettings = trpc.campaigns.updateSettings.useMutation({
    onSuccess: () => {
      void utils.campaigns.getById.invalidate({ id: campaignId });
      toast({ title: 'Settings saved', description: 'Integration settings updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const generateFoundryApiKey = trpc.foundry.generateApiKey.useMutation({
    onSuccess: (data) => {
      setLatestApiKey(data.apiKey);
      void utils.campaigns.getById.invalidate({ id: campaignId });
      toast({ title: 'Foundry API key regenerated', description: 'Copy this key now. It will only be shown once.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function copyValue(value: string, label: string) {
    void navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  }

  function getStatusClass(status: string) {
    if (status === 'delivered') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    if (status === 'error') return 'bg-destructive/10 text-destructive border-destructive/30';
    return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  }

  function getStatusLabel(status: string) {
    if (status === 'delivered') return 'Delivered';
    if (status === 'error') return 'Error';
    return 'Pending';
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload/campaign-banner', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json() as { url: string };
      setBannerUrl(url);
      update.mutate({ id: campaignId, bannerUrl: url }, {
        onError: () => toast({ title: 'Banner save failed', description: 'Image uploaded but could not be saved.', variant: 'destructive' }),
      });
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload banner image.', variant: 'destructive' });
    } finally {
      setBannerUploading(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    update.mutate({
      id: campaignId,
      name,
      description: description || undefined,
      status: status as any,
    });
  }

  if (campaign.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{campaign.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => campaign.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const recentImportJobs = (((importJobsQuery.data as any)?.jobs ?? importJobsQuery.data ?? []) as any[])
    .slice(0, 10);

  return (
    <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="stone-card">
        <div className="stone-card-header">
          <span className="stone-card-title">Campaign Settings</span>
          <p className="text-sm text-muted-foreground">Update your campaign details</p>
        </div>
        <div className="stone-card-body">
          <form onSubmit={handleSave} className="space-y-4">
            {isOwner && (
              <div className="space-y-2">
                <Label>Campaign Banner</Label>
                {bannerUrl && (
                  <div className="relative h-32 w-full rounded-md overflow-hidden border border-border">
                    <Image src={bannerUrl} alt="Campaign banner" fill className="object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="banner-upload"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {bannerUploading ? 'Uploading...' : bannerUrl ? 'Change Image' : 'Upload Image'}
                  </label>
                  <input
                    id="banner-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleBannerUpload}
                    disabled={bannerUploading}
                  />
                  {bannerUrl && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setBannerUrl(null);
                        update.mutate({ id: campaignId, bannerUrl: '' });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Max 5MB — JPEG, PNG, WebP, or GIF</p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
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
            <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>
      </div>

      {isDM && <WebhookSettings campaignId={campaignId} />}

      {isDM && (
        <div className="stone-card">
          <div className="stone-card-header">
            <span className="stone-card-title">AI & Integrations</span>
            <p className="text-sm text-muted-foreground">Configure AI context and external integrations</p>
          </div>
          <div className="stone-card-body space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sourcebook">Sourcebook</Label>
                <Input
                  id="sourcebook"
                  value={sourcebook}
                  onChange={(e) => setSourcebook(e.target.value)}
                  placeholder="e.g. Curse of Strahd, Homebrew"
                />
                <p className="text-xs text-muted-foreground">
                  The rulebook or adventure module. Included in AI summaries for lore context.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                <Input
                  id="discord-webhook"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                />
                <p className="text-xs text-muted-foreground">
                  Session summaries auto-post here. Create a webhook in your Discord server settings.
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={updateSettings.isPending}
              onClick={() => updateSettings.mutate({
                campaignId,
                sourcebook: sourcebook || undefined,
                discordWebhookUrl: discordWebhookUrl || undefined,
              })}
            >
              {updateSettings.isPending ? 'Saving...' : 'Save Integration Settings'}
            </Button>
          </div>
        </div>
      )}

      {isDM && foundryEnabled && (
        <div className="stone-card">
          <div className="stone-card-header">
            <span className="stone-card-title flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Foundry Integration
            </span>
            <p className="text-sm text-muted-foreground">
              Use this API key in the QuiverDM Foundry module settings.
            </p>
          </div>
          <div className="stone-card-body space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={latestApiKey ?? ((campaign.data as any)?.foundryApiKey ? 'Configured (hidden)' : 'Not configured')}
                  className="font-mono text-xs"
                />
                {latestApiKey && (
                  <Button size="sm" variant="outline" onClick={() => copyValue(latestApiKey, 'API key')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Raw keys are only shown once after generation.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Module ID</p>
                <p className="text-xs text-muted-foreground font-mono">quiverdm</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyValue('quiverdm', 'Module ID')}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => generateFoundryApiKey.mutate({ campaignId })}
              disabled={generateFoundryApiKey.isPending}
            >
              {generateFoundryApiKey.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Regenerate API Key
            </Button>

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="recent-exports" className="border-b-0">
                <AccordionTrigger className="py-2">Recent Exports</AccordionTrigger>
                <AccordionContent className="pt-1">
                  {importJobsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading recent exports...</p>
                  ) : recentImportJobs.length > 0 ? (
                    <div className="space-y-2">
                      {recentImportJobs.map((job) => (
                        <div key={job.id} className="rounded-md border border-border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{job.sourceName}</p>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {String(job.type).replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline" className={getStatusClass(job.status)}>
                              {getStatusLabel(job.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          {job.status === 'pending' && (
                            <p className="mt-1 text-xs text-amber-500">waiting for Foundry module...</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No exports yet.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      )}

      {isOwner && (
        <>
          <Separator />
          <div className="stone-card border-destructive/50">
            <div className="stone-card-header">
              <span className="stone-card-title text-destructive">Danger Zone</span>
              <p className="text-sm text-muted-foreground">
                Permanently delete this campaign and all its data.
              </p>
            </div>
            <div className="stone-card-body">
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteCampaign.isPending}
              >
                {deleteCampaign.isPending ? 'Deleting...' : 'Delete Campaign'}
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Campaign"
        description="Are you sure? This will permanently delete this campaign and all its data. This action cannot be undone."
        confirmLabel="Delete Campaign"
        variant="destructive"
        onConfirm={() => deleteCampaign.mutate({ id: campaignId })}
        loading={deleteCampaign.isPending}
      />
    </div>
  );
}
