'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

type AddToCampaignDialogProps = {
  characterId: string;
  existingCampaignIds?: string[];
  onAdded?: () => void;
};

export function AddToCampaignDialog({
  characterId,
  existingCampaignIds = [],
  onAdded,
}: AddToCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const memberships = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });

  const addToCampaign = trpc.characters.addToCampaign.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Character submitted',
        description: `Sent to ${result.campaign.name} for approval.`,
      });
      utils.characters.getById.invalidate({ id: characterId });
      setOpen(false);
      setCampaignId('');
      onAdded?.();
    },
    onError: (error) =>
      toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const availableCampaigns = useMemo(() => {
    const existing = new Set(existingCampaignIds);
    return (memberships.data ?? []).filter((campaign: any) => !existing.has(campaign.id));
  }, [existingCampaignIds, memberships.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add to Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Character to Campaign</DialogTitle>
          <DialogDescription>
            Submit this character to a campaign. DMs will see it as pending until approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Campaign</div>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {availableCampaigns.map((campaign: any) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableCampaigns.length === 0 && !memberships.isLoading && (
            <p className="text-xs text-muted-foreground">
              No eligible campaigns available.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => addToCampaign.mutate({ characterId, campaignId })}
            disabled={!campaignId || addToCampaign.isPending}
          >
            {addToCampaign.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

