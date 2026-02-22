'use client';

import { useState } from 'react';
import { Play, Swords } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'bg-green-500/10 text-green-600',
  medium: 'bg-yellow-500/10 text-yellow-600',
  hard:   'bg-orange-500/10 text-orange-600',
  deadly: 'bg-red-500/10 text-red-600',
};

interface LoadEncounterPlanDialogProps {
  campaignId: string;
  sessionId: string;
}

export function LoadEncounterPlanDialog({ campaignId, sessionId }: LoadEncounterPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const plansQuery = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { enabled: open, staleTime: 30_000 }
  );

  const launchMutation = trpc.encounterPlans.launchToTracker.useMutation({
    onSuccess: () => {
      toast.success('Encounter loaded into tracker');
      void utils.encounters.getBySession.invalidate({ sessionId });
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const plans = plansQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Swords className="h-4 w-4 mr-2" />
          Load Encounter Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Load Encounter Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {plansQuery.isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          )}
          {!plansQuery.isLoading && plans.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No encounter plans yet. Create one in the Encounters tab.
            </p>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {plans.map((plan: any) => (
            <div
              key={plan.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{plan.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${DIFFICULTY_COLORS[plan.difficulty] ?? ''}`}
                  >
                    {plan.difficulty}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {plan.creatures?.length ?? 0} creature
                  {(plan.creatures?.length ?? 0) !== 1 ? 's' : ''}
                  {plan.partySize && plan.partyLevel
                    ? ` · ${plan.partySize} players Lv. ${plan.partyLevel}`
                    : ''}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  launchMutation.mutate({ planId: plan.id, sessionId })
                }
                disabled={launchMutation.isPending}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Launch
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
