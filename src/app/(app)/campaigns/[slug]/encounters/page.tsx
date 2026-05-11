'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Swords, Sparkles, Trash2, Shield, Skull, Flame, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, Surface, Pill } from '@/components/primitives';
import type { ComponentProps } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BentoCanvas } from '@/components/layout/bento-canvas';

type PillVariant = NonNullable<ComponentProps<typeof Pill>['variant']>;

const DIFF: Record<
  'easy' | 'medium' | 'hard' | 'deadly',
  { label: string; pill: PillVariant; bar: string; icon: typeof Shield }
> = {
  easy:   { label: 'Easy',   pill: 'neutral', bar: 'bg-[var(--q-border-subtle)]',  icon: Shield },
  medium: { label: 'Medium', pill: 'info',    bar: 'bg-[var(--q-amber-dim)]',      icon: Zap },
  hard:   { label: 'Hard',   pill: 'warning', bar: 'bg-[var(--q-amber)]',          icon: Flame },
  deadly: { label: 'Deadly', pill: 'danger',  bar: 'bg-[oklch(0.6_0.2_25_/_0.6)]', icon: Skull },
} as const;

type DiffKey = keyof typeof DIFF;

export default function EncountersPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]" />}>
      <EncountersPageInner />
    </Suspense>
  );
}

function EncountersPageInner() {
  const { campaignId, slug, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const prefersReducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [newPlanOpen, setNewPlanOpen] = useState(searchParams.get('create') === 'true');

  useEffect(() => {
    if (searchParams.get('create') === 'true') setNewPlanOpen(true);
  }, [searchParams]);
  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

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

  const gridVariants = {
    hidden: {},
    visible: {
      transition: prefersReducedMotion ? {} : { staggerChildren: 0.06 },
    },
  };

  const cardVariants = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, scale: 0.97, y: 8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 300, damping: 25 },
    },
  };

  return (
    <BentoCanvas
      overline="Encounters"
      title="Encounter Plans"
      actions={
        isDM ? (
          <Button onClick={() => setNewPlanOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Encounter
          </Button>
        ) : undefined
      }
    >
      {/* Cards */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 rounded-sm" />)}
        </div>
      ) : plans.length === 0 ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
        >
          <Card variant="detail" className="flex flex-col items-center justify-center gap-5 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] flex items-center justify-center">
              <Swords className="h-7 w-7 text-[var(--q-text-faint)]" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h3 className="font-[var(--q-font-display)] text-xl text-[var(--q-text)]">No encounters planned</h3>
              <p className="text-sm text-[var(--q-text-dim)]">
                Build encounters with AI assistance — monsters, tactics, scene descriptions, and XP calculations.
              </p>
            </div>
            {isDM && (
              <Button onClick={() => setNewPlanOpen(true)} size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Plan First Encounter
              </Button>
            )}
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {plans.map((plan) => {
            const key = (plan.difficulty ?? 'medium') as DiffKey;
            const d = DIFF[key] ?? DIFF.medium;
            const DiffIcon = d.icon;
            const creatureCount = plan._count?.creatures ?? plan.creatures?.length ?? 0;

            return (
              <motion.div key={plan.id} variants={cardVariants} className="relative group">
                <Link href={`/campaigns/${slug}/encounters/${plan.id}`} className="block h-full">
                  <Surface
                    variant="utility"
                    className="h-full overflow-hidden flex flex-col hover:border-[var(--q-amber-border)] transition-colors"
                  >
                    {/* Portrait header OR difficulty bar */}
                    {plan.portraitUrl ? (
                      <div className="h-24 bg-cover bg-center relative" style={{ backgroundImage: `url(${plan.portraitUrl})` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--q-surface-utility)] via-[var(--q-surface-utility)]/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-semibold text-sm leading-tight text-[var(--q-text)]">{plan.name}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-1 w-full overflow-hidden">
                        <div className={`h-full w-full ${d.bar}`} />
                      </div>
                    )}

                    <div className="flex flex-col flex-1 p-4 gap-2.5">
                      {!plan.portraitUrl && (
                        <h3 className="font-semibold text-sm leading-tight text-[var(--q-text)]">{plan.name}</h3>
                      )}

                      {/* Difficulty pill */}
                      <Pill variant={d.pill} className="w-fit gap-1">
                        <DiffIcon className="h-3 w-3" />
                        {d.label}
                      </Pill>

                      {/* Scene excerpt */}
                      {plan.sceneDescription && (
                        <p className="text-xs text-[var(--q-text-dim)] line-clamp-2 leading-relaxed">
                          {plan.sceneDescription}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="mt-auto pt-2.5 border-t border-[var(--q-border-subtle)] flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--q-text-dim)]">
                        {plan.partySize && plan.partyLevel && (
                          <span>{plan.partySize}p · Lv.{plan.partyLevel}</span>
                        )}
                        <span>{creatureCount} {creatureCount === 1 ? 'creature' : 'creatures'}</span>
                        {plan.adjustedXp > 0 && (
                          <span className="text-[var(--q-amber)] font-medium">{plan.adjustedXp.toLocaleString()} XP</span>
                        )}
                      </div>
                      <time className="text-xs text-[var(--q-text-faint)]">
                        {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                      </time>
                    </div>
                  </Surface>
                </Link>

                {/* Hover delete */}
                {isDM && (
                  <button
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-sm bg-[var(--q-surface-feature)]/90 backdrop-blur-sm border border-[var(--q-border-subtle)] hover:bg-destructive hover:text-destructive-foreground text-[var(--q-text-dim)] z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingPlanId(plan.id);
                    }}
                    disabled={deletingId === plan.id}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* New encounter dialog */}
      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[var(--q-font-display)] tracking-wide flex items-center gap-2">
              <Swords className="h-4 w-4 text-[var(--q-amber)]" />
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
      <ConfirmDialog
        open={deletingPlanId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPlanId(null);
        }}
        title="Delete encounter plan?"
        description="This will permanently delete the plan and all its creatures. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deletingPlanId) {
            setDeletingId(deletingPlanId);
            deleteMutation.mutate({ planId: deletingPlanId });
            setDeletingPlanId(null);
          }
        }}
        loading={deleteMutation.isPending}
      />
    </BentoCanvas>
  );
}
