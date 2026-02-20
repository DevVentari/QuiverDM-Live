'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { getTypeStyle } from '@/lib/homebrew-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

type AddFromLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  onAdded: () => void;
};

type HomebrewListItem = {
  id: string;
  name: string;
  type: string;
};

export function AddFromLibraryDialog({
  open,
  onOpenChange,
  campaignId,
  onAdded,
}: AddFromLibraryDialogProps) {
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const library = trpc.homebrew.getContent.useQuery(
    { search: search || undefined },
    { enabled: open, staleTime: 30_000 }
  );
  const campaignContent = trpc.homebrew.getContent.useQuery(
    { campaignId },
    { enabled: open, staleTime: 30_000 }
  );

  const addToCampaign = trpc.homebrew.addToCampaign.useMutation();

  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of (((campaignContent.data as any)?.items || []) as HomebrewListItem[])) {
      ids.add(item.id);
    }
    for (const id of addedIds) {
      ids.add(id);
    }
    return ids;
  }, [campaignContent.data, addedIds]);

  const items = (((library.data as any)?.items || []) as HomebrewListItem[]);

  async function handleAdd(item: HomebrewListItem) {
    if (campaignIds.has(item.id) || addingId) return;
    setAddingId(item.id);
    try {
      await addToCampaign.mutateAsync({
        homebrewId: item.id,
        campaignId,
      });
      setAddedIds((prev) => new Set(prev).add(item.id));
      toast.success('Added to campaign', {
        description: item.name,
      });
      onAdded();
    } catch (error) {
      toast.error('Failed to add homebrew', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Homebrew to Campaign</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search your homebrew library..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea className="h-96 rounded-md border">
          <div className="space-y-2 p-2">
            {library.isLoading ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">Loading library...</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">No homebrew found.</p>
            ) : (
              items.map((item) => {
                const style = getTypeStyle(item.type);
                const isAdded = campaignIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <Badge variant="outline" className={`text-xs ${style.color}`}>
                        {style.label}
                      </Badge>
                    </div>

                    {isAdded ? (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAdd(item)}
                        disabled={!!addingId}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
