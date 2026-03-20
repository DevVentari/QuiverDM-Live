'use client';

import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { Button } from '@/components/ui/button';

function useRouteContext() {
  const pathname = usePathname();
  const encounterMatch = pathname.match(/\/campaigns\/([^/]+)\/encounters\/([^/]+)/);
  const sessionMatch = pathname.match(/\/sessions\/([^/]+)\/live/);
  const campaignSlugMatch = pathname.match(/\/campaigns\/([^/]+)/);
  const campaignSlug = campaignSlugMatch?.[1] ?? null;

  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );

  return {
    campaignSlug,
    campaignId: campaignData?.id ?? null,
    currentPlanId: encounterMatch?.[2] ?? null,
    currentSessionId: sessionMatch?.[1] ?? null,
  };
}

function EncounterDetail({ planId }: { planId: string }) {
  const { campaignSlug, campaignId, currentPlanId, currentSessionId } = useRouteContext();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: plan } = trpc.encounterPlans.getById.useQuery({ planId });

  const resolvedCampaignId = campaignId ?? (plan as any)?.campaignId ?? null;

  const { data: chapterContent } = trpc.homebrew.getContent.useQuery(
    { campaignId: resolvedCampaignId!, type: 'location' },
    { enabled: !!resolvedCampaignId && !!(plan as any)?.ddbChapterId }
  );
  const chapterData = chapterContent?.items?.find(
    (item: any) => item.dndBeyondId === (plan as any)?.ddbChapterId
  );
  const monsterLinks: { ddbId: string; name: string }[] =
    (chapterData?.data as any)?.monsterLinks ?? [];

  const updateMutation = trpc.encounterPlans.update.useMutation();
  const createMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (newPlan) => {
      router.push(`/campaigns/${campaignSlug}/encounters/${newPlan.id}`);
    },
  });
  const markAsRunMutation = trpc.encounterPlans.markAsRun.useMutation({
    onSuccess: () => utils.encounterPlans.getBySourcebook.invalidate(),
  });

  if (!plan) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  const handleLoadToBuilder = () => {
    if (currentPlanId) {
      updateMutation.mutate({
        planId: currentPlanId,
        name: (plan as any).name,
        difficulty: (plan as any).difficulty as any,
        sceneDescription: (plan as any).sceneDescription ?? undefined,
        ddbChapterId: (plan as any).ddbChapterId ?? undefined,
      });
    } else if (campaignSlug) {
      createMutation.mutate({
        campaignId: (plan as any).campaignId,
        name: (plan as any).name,
        difficulty: (plan as any).difficulty as any,
        ddbChapterId: (plan as any).ddbChapterId ?? undefined,
      });
    }
  };

  const handleMarkAsRun = () => {
    markAsRunMutation.mutate({
      planId: plan.id,
      sessionId: currentSessionId ?? undefined,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-[hsl(240_20%_85%/0.07)]">
        <h3 className="font-display text-sm font-semibold text-foreground">{(plan as any).name}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{(plan as any).difficulty}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {(plan as any).sceneDescription && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Scene</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{(plan as any).sceneDescription}</p>
          </div>
        )}

        {monsterLinks.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Monsters available in this chapter</p>
            <div className="space-y-1">
              {monsterLinks.map((m) => (
                <div key={m.ddbId} className="px-2.5 py-1.5 rounded bg-[hsl(240_10%_10%/0.5)] border border-[hsl(240_20%_85%/0.06)]">
                  <span className="text-xs text-foreground/70">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[hsl(240_20%_85%/0.07)] space-y-2">
        <Button
          size="sm"
          className="w-full bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50"
          onClick={handleLoadToBuilder}
          disabled={updateMutation.isPending || createMutation.isPending}
        >
          Load to Encounter Builder
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-blue-800/40 text-blue-400 hover:bg-blue-900/20"
          onClick={() => campaignSlug && router.push(`/campaigns/${campaignSlug}/brain?encounter=${plan.id}`)}
          disabled={!campaignSlug}
        >
          Prep with DM Brain
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-[var(--card-stone-border)] text-[var(--card-amber)] hover:bg-[hsl(35_30%_10%)]"
          onClick={handleMarkAsRun}
          disabled={markAsRunMutation.isPending}
        >
          Mark as Run
        </Button>
      </div>
    </div>
  );
}

export function DetailPane() {
  const { selectedItemId, selectedItemType } = useCompendiumStore();

  if (!selectedItemId) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <p className="text-sm text-muted-foreground">Select an item to see details</p>
      </div>
    );
  }

  if (selectedItemType === 'encounter') {
    return <EncounterDetail planId={selectedItemId} />;
  }

  return null;
}
