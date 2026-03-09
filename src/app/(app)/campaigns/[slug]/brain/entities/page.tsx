'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EntityCard } from '@/components/brain/entity-card';
import { Brain, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

const TYPE_TABS = ['All', ...Object.values(WorldEntityType)] as const;
const STATUS_OPTIONS = Object.values(WorldEntityStatus);

export default function EntitiesPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') as WorldEntityType | null;

  const [activeType, setActiveType] = useState<WorldEntityType | 'All'>(initialType ?? 'All');
  const [activeStatus, setActiveStatus] = useState<WorldEntityStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // New entity form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WorldEntityType>(WorldEntityType.NPC);
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<WorldEntityStatus>(WorldEntityStatus.active);

  const entitiesQuery = trpc.brain.entities.list.useQuery(
    {
      campaignId,
      type: activeType === 'All' ? undefined : activeType,
      status: activeStatus === 'all' ? undefined : activeStatus,
      search: search || undefined,
    },
    { enabled: isDM, staleTime: 30_000 }
  );

  const upsertMutation = trpc.brain.entities.upsert.useMutation({
    onSuccess: () => {
      toast.success('Entity created.');
      setDialogOpen(false);
      setNewName('');
      setNewDescription('');
      entitiesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isDM) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Brain className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">DM Brain is only accessible to Dungeon Masters.</p>
      </div>
    );
  }

  const entities = entitiesQuery.data ?? [];

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-overline">DM Brain</p>
          <h2 className="text-lg sm:text-xl font-semibold">Entities</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Entity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Entity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Lord Strahd von Zarovich"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as WorldEntityType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(WorldEntityType).map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as WorldEntityStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                disabled={!newName.trim() || upsertMutation.isPending}
                onClick={() =>
                  upsertMutation.mutate({
                    campaignId,
                    name: newName.trim(),
                    type: newType,
                    status: newStatus,
                    description: newDescription || undefined,
                  })
                }
              >
                Create Entity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
        {TYPE_TABS.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type as WorldEntityType | 'All')}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={activeStatus} onValueChange={(v) => setActiveStatus(v as WorldEntityStatus | 'all')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {entitiesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : entitiesQuery.isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load entities. Please refresh.</p>
        </Card>
      ) : entities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {search || activeType !== 'All' || activeStatus !== 'all'
                ? 'Try adjusting your filters.'
                : 'Start tracking the people, places, and powers that shape your world.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              href={`/campaigns/${slug}/brain/entities/${entity.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
