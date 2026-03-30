'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { AddFromLibraryDialog } from '@/components/homebrew/add-from-library-dialog';
import { BookOpen, Search, Library } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignHomebrewPage() {
  const { campaignId, isDM } = useCampaign();
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const utils = trpc.useUtils();

  const content = trpc.homebrew.getContent.useQuery(
    { campaignId, search: search || undefined },
    { staleTime: 30_000 }
  );

  const updateSharingMutation = trpc.homebrew.updateSharing.useMutation({
    onSuccess: () => utils.homebrew.getContent.invalidate({ campaignId, search: search || undefined }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Homebrew</h2>
        {isDM && (
          <Button size="sm" variant="outline" onClick={() => setLibraryOpen(true)}>
            <Library className="mr-2 h-4 w-4" />
            Add from Library
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaign homebrew..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {content.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : content.data && (content.data as any).items?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {((content.data as any).items || []).map((item: any) => (
            <div key={item.id} className="space-y-2">
              <HomebrewContentCard item={item} href={`/homebrew/${item.id}`} />
              {isDM && (
                <div className="flex items-center gap-2 px-1">
                  <Switch
                    id={`share-${item.id}`}
                    checked={Boolean(item.sharedWithPlayers)}
                    onCheckedChange={(checked: boolean) =>
                      updateSharingMutation.mutate({ homebrewId: item.id, sharedWithPlayers: checked })
                    }
                  />
                  <Label htmlFor={`share-${item.id}`} className="text-xs text-muted-foreground">
                    Share with players
                  </Label>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No homebrew linked to this campaign.</p>
            {isDM && (
              <Button size="sm" variant="outline" onClick={() => setLibraryOpen(true)}>
                <Library className="mr-2 h-4 w-4" />
                Add from Library
              </Button>
            )}
          </div>
        </div>
      )}

      <AddFromLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        campaignId={campaignId}
        campaignItems={((content.data as any)?.items || []).map((item: any) => ({ id: item.id }))}
        onAdded={() => content.refetch()}
      />
    </div>
  );
}
