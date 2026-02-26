'use client';

import { Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';

type ExportType = 'npc' | 'homebrew_item' | 'homebrew_spell' | 'session_journal';

interface ExportToFoundryButtonProps {
  campaignId?: string;
  type: ExportType;
  sourceId: string;
  sourceName: string;
  size?: 'sm' | 'default';
}

export function ExportToFoundryButton({
  campaignId,
  type,
  sourceId,
  sourceName,
  size = 'sm',
}: ExportToFoundryButtonProps) {
  if (process.env.NEXT_PUBLIC_FOUNDRY_BRIDGE_ENABLED !== 'true') {
    return null;
  }

  const { campaignId: campaignIdFromContext } = useCampaign();
  const { toast } = useToast();

  const createImportJob = (trpc as any).foundry.createImportJob.useMutation({
    onSuccess: () => {
      toast({
        title: 'Sent to Foundry',
        description: `'${sourceName}' queued for import`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={() => createImportJob.mutate({ campaignId: campaignId ?? campaignIdFromContext, type, sourceId })}
      disabled={createImportJob.isPending}
    >
      <Upload className="mr-1 h-4 w-4" />
      {createImportJob.isPending ? 'Sending...' : 'Send to Foundry'}
    </Button>
  );
}
