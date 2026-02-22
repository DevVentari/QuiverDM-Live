'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCampaign } from '@/components/campaign/campaign-context';
import { WebhookSettings } from '@/components/campaign/webhook-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (campaign.data) {
      const data = campaign.data as any;
      setName(data.name || '');
      setDescription(data.description || '');
      setStatus(data.status || 'active');
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

  return (
    <div className="space-y-6 max-w-2xl px-4 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
          <CardDescription>Update your campaign details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
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
            <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isDM && <WebhookSettings campaignId={campaignId} />}

      {isOwner && (
        <>
          <Separator />
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete this campaign and all its data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteCampaign.isPending}
              >
                {deleteCampaign.isPending ? 'Deleting...' : 'Delete Campaign'}
              </Button>
            </CardContent>
          </Card>
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
