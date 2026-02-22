'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Swords, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  hard:   'bg-orange-500/10 text-orange-600 border-orange-500/20',
  deadly: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function EncountersPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const plansQuery = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { staleTime: 30_000 }
  );

  const createMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (plan) => {
      void utils.encounterPlans.getByCampaign.invalidate({ campaignId });
      setNewPlanOpen(false);
      setNewName('');
      // Navigate to builder
      window.location.href = `/campaigns/${slug}/encounters/${plan.id}`;
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ campaignId, name: newName.trim() });
  };

  const plans = plansQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encounters</h1>
          <p className="text-muted-foreground text-sm">Design encounters before your session</p>
        </div>
        {isDM && (
          <div className="flex gap-2">
            <Button onClick={() => setNewPlanOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Encounter
            </Button>
          </div>
        )}
      </div>

      {/* Plans list */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="font-semibold mb-1">No encounters yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Design encounters before your session — AI generates scene + monsters + tactics.
            </p>
            {isDM && (
              <Button onClick={() => setNewPlanOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Create First Encounter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {plans.map((plan: any) => (
            <Link
              key={plan.id}
              href={`/campaigns/${slug}/encounters/${plan.id}`}
              className="block"
            >
              <Card className="hover:border-foreground/30 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{plan.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize shrink-0 ${DIFFICULTY_COLORS[plan.difficulty] ?? ''}`}
                    >
                      {plan.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plan.sceneDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {plan.sceneDescription}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {plan.partySize && plan.partyLevel && (
                      <span>
                        {plan.partySize} players, Lv. {plan.partyLevel}
                      </span>
                    )}
                    <span>
                      {(plan._count?.creatures ?? plan.creatures?.length ?? 0)} creature
                      {(plan._count?.creatures ?? plan.creatures?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    {plan.adjustedXp && (
                      <span>{plan.adjustedXp.toLocaleString()} adj. XP</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New encounter dialog */}
      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Encounter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Goblin Ambush"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNewPlanOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
              >
                Create &amp; Open Builder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
