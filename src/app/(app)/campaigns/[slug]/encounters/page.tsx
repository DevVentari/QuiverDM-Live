'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Swords, Sparkles, Trash2, Shield, Skull, Flame, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DIFF = {
  easy:   { label: 'Easy',   bar: 'bg-emerald-500',  badge: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: Shield,  pct: 25 },
  medium: { label: 'Medium', bar: 'bg-amber-500',    badge: 'text-amber-400 border-amber-500/30 bg-amber-500/10',       icon: Zap,    pct: 50 },
  hard:   { label: 'Hard',   bar: 'bg-orange-500',   badge: 'text-orange-400 border-orange-500/30 bg-orange-500/10',    icon: Flame,  pct: 75 },
  deadly: { label: 'Deadly', bar: 'bg-red-600',      badge: 'text-red-400 border-red-500/30 bg-red-500/10',             icon: Skull,  pct: 100 },
} as const;

type DiffKey = keyof typeof DIFF;

export default function EncountersPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = trpc.encounterPlans.delete.useMutation({
    onSuccess: () => {
      void utils.encounterPlans.getByCampaign.invalidate({ campaignId });
      toast.success('Encounter deleted');
    },
    onError:   (err) => toast.error(err.message),
    onSettled: () => setDeletingId(null),
  });

  const plansQuery = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { staleTime: 30_000 }
  );

  const createMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (plan) => {
      void utils.encounterPlans.getByCampaign.invalidate({ campaignId });
      setNewPlanOpen(false);
      setNewName('');
      window.location.href = `/campaigns/${slug}/encounters/${plan.id}`;
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ campaignId, name: newName.trim() });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans = (plansQuery.data ?? []) as any[];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Encounter Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {plans.length > 0
              ? `${plans.length} plan${plans.length !== 1 ? 's' : ''} — design before you run`
              : 'Design and balance encounters before your session'}
          </p>
        </div>
        {isDM && (
          <Button onClick={() => setNewPlanOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Encounter
          </Button>
        )}
      </div>

      {/* Cards */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="relative rounded-lg border border-dashed border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/15 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-5">
              <Swords className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">No encounters planned</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Build encounters with AI assistance — monsters, tactics, scene descriptions, and XP calculations.
            </p>
            {isDM && (
              <Button onClick={() => setNewPlanOpen(true)} size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Plan First Encounter
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const key = (plan.difficulty ?? 'medium') as DiffKey;
            const d = DIFF[key] ?? DIFF.medium;
            const DiffIcon = d.icon;
            const creatureCount = plan._count?.creatures ?? plan.creatures?.length ?? 0;

            return (
              <div key={plan.id} className="relative group">
                <Link href={`/campaigns/${slug}/encounters/${plan.id}`} className="block h-full">
                  <div className="relative h-full rounded-lg border border-border bg-card hover:border-foreground/25 transition-all duration-200 overflow-hidden flex flex-col">

                    {/* Portrait header OR difficulty bar */}
                    {plan.portraitUrl ? (
                      <div className="h-24 bg-cover bg-center relative" style={{ backgroundImage: `url(${plan.portraitUrl})` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-semibold text-sm leading-tight">{plan.name}</p>
                        </div>
                      </div>
                    ) : (
                      /* Thin difficulty colour bar + hover glow */
                      <div className="h-1 w-full overflow-hidden">
                        <div className={`h-full w-full ${d.bar} opacity-60`} />
                      </div>
                    )}

                    <div className="flex flex-col flex-1 p-4 gap-2.5">
                      {!plan.portraitUrl && (
                        <h3 className="font-semibold text-sm leading-tight">{plan.name}</h3>
                      )}

                      {/* Difficulty badge */}
                      <Badge variant="outline" className={`w-fit text-xs flex items-center gap-1 ${d.badge}`}>
                        <DiffIcon className="h-3 w-3" />
                        {d.label}
                      </Badge>

                      {/* Scene excerpt */}
                      {plan.sceneDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {plan.sceneDescription}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="mt-auto pt-2.5 border-t border-border/40 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {plan.partySize && plan.partyLevel && (
                          <span>{plan.partySize}p · Lv.{plan.partyLevel}</span>
                        )}
                        <span>{creatureCount} {creatureCount === 1 ? 'creature' : 'creatures'}</span>
                        {plan.adjustedXp > 0 && (
                          <span className="text-amber-500/80 font-medium">{plan.adjustedXp.toLocaleString()} XP</span>
                        )}
                      </div>
                      <time className="text-xs text-muted-foreground/50">
                        {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                      </time>
                    </div>
                  </div>
                </Link>

                {/* Hover delete */}
                {isDM && (
                  <button
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-background/90 backdrop-blur-sm border border-border/50 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(`Delete "${plan.name}"?`)) return;
                      setDeletingId(plan.id);
                      deleteMutation.mutate({ planId: plan.id });
                    }}
                    disabled={deletingId === plan.id}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New encounter dialog */}
      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide flex items-center gap-2">
              <Swords className="h-4 w-4 text-red-400" />
              New Encounter Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Goblin Ambush at the Bridge"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNewPlanOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {createMutation.isPending ? 'Creating…' : 'Create & Open Builder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
