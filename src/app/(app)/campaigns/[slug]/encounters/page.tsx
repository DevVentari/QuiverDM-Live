'use client';

import { Suspense, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Swords, Sparkles } from 'lucide-react';
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
import { Card } from '@/components/primitives';
import { toast } from 'sonner';
import { BentoCanvas } from '@/components/layout/bento-canvas';
import { EncounterCard } from '@/components/encounters/encounter-card';


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
          {plans.map((plan) => (
            <motion.div key={plan.id} variants={cardVariants}>
              <EncounterCard
                plan={plan}
                href={`/campaigns/${slug}/encounters/${plan.id}`}
                isDM={isDM}
                onDelete={() => setDeletingPlanId(plan.id)}
                isDeleting={deletingId === plan.id}
              />
            </motion.div>
          ))}
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
