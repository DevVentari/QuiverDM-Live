'use client';

import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { Button } from '@/components/ui/button';
import { MonsterStatBlock, type MonsterStatBlockData } from '@/components/homebrew/MonsterStatBlock';

type PlanData = {
  id: string;
  campaignId: string;
  name: string;
  difficulty: string | null;
  sceneDescription?: string | null;
  ddbChapterId?: string | null;
};

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
  const typedPlan = plan as unknown as PlanData | undefined;

  const resolvedCampaignId = campaignId ?? typedPlan?.campaignId ?? null;

  const { data: chapterContent } = trpc.homebrew.getContent.useQuery(
    { campaignId: resolvedCampaignId ?? undefined, type: 'location' },
    { enabled: !!resolvedCampaignId && !!typedPlan?.ddbChapterId }
  );
  const chapterData = chapterContent?.items?.find(
    (item: any) => item.dndBeyondId === typedPlan?.ddbChapterId
  );
  const monsterLinks: { ddbId: string; name: string }[] =
    (chapterData?.data as any)?.monsterLinks ?? [];

  const updateMutation = trpc.encounterPlans.update.useMutation();
  const createMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (newPlan) => {
      if (campaignSlug) router.push(`/campaigns/${campaignSlug}/encounters/${newPlan.id}`);
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
        name: typedPlan!.name,
        difficulty: typedPlan!.difficulty as any,
        sceneDescription: typedPlan!.sceneDescription ?? undefined,
        ddbChapterId: typedPlan!.ddbChapterId ?? undefined,
      });
    } else if (campaignSlug) {
      createMutation.mutate({
        campaignId: typedPlan!.campaignId,
        name: typedPlan!.name,
        difficulty: typedPlan!.difficulty as any,
        ddbChapterId: typedPlan!.ddbChapterId ?? undefined,
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
      <div className="px-4 pt-4 pb-3 border-b border-[hsl(240_20%_85%/0.07)]">
        <h3
          className="font-display text-base font-bold leading-snug"
          style={{ color: 'hsl(35 80% 68%)', textShadow: '0 0 14px hsl(35 80% 48% / 0.2)' }}
        >
          {typedPlan!.name}
        </h3>
        {typedPlan!.difficulty && (
          <span
            className="inline-block mt-1.5 text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-sans"
            style={{ background: 'hsl(35 50% 10%)', border: '1px solid hsl(35 50% 22%)', color: 'hsl(35 70% 52%)' }}
          >
            {typedPlan!.difficulty}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {typedPlan!.sceneDescription && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Scene</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{typedPlan!.sceneDescription}</p>
          </div>
        )}

        {monsterLinks.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2">Creatures</p>
            <div className="space-y-1">
              {monsterLinks.map((m: { ddbId: string; name: string; cr?: string }) => (
                <div key={m.ddbId} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[hsl(240_10%_10%/0.5)] border border-[hsl(240_20%_85%/0.06)]">
                  <span className="text-xs text-foreground/80">{m.name}</span>
                  {m.cr && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: 'hsl(240 10% 16%)', color: 'hsl(240 5% 55%)' }}>
                      CR {m.cr}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[hsl(240_20%_85%/0.07)] space-y-2">
        <Button
          size="sm"
          className="w-full font-sans text-xs"
          style={{ background: 'linear-gradient(135deg, hsl(35 80% 48%), hsl(35 70% 38%))', color: 'hsl(35 20% 12%)', border: 'none' }}
          onClick={handleLoadToBuilder}
          disabled={updateMutation.isPending || createMutation.isPending}
        >
          Load to Encounter Builder
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-[var(--card-stone-border)] text-muted-foreground hover:text-foreground hover:bg-white/5"
            onClick={() => campaignSlug && router.push(`/campaigns/${campaignSlug}/brain?encounter=${plan.id}`)}
            disabled={!campaignSlug}
          >
            DM Brain
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-[var(--card-stone-border)] text-muted-foreground hover:text-foreground hover:bg-white/5"
            onClick={handleMarkAsRun}
            disabled={markAsRunMutation.isPending}
          >
            Mark Run
          </Button>
        </div>
      </div>
    </div>
  );
}

type MonsterItemData = {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
};

function MonsterDetail({ monsterId }: { monsterId: string }) {
  const { campaignId, currentPlanId } = useRouteContext();
  const { data: result } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId ?? undefined, type: 'creature' },
    { enabled: !!campaignId }
  );
  const monster = (result?.items ?? []).find((m: any) => m.id === monsterId) as MonsterItemData | undefined;

  const addCreatureMutation = trpc.encounterPlans.addCreature.useMutation();

  if (!monster) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!monster.data) return null;

  const statBlock = monster.data as unknown as MonsterStatBlockData;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <MonsterStatBlock monster={statBlock} mode="full" />
      </div>
      {currentPlanId && (
        <div className="px-4 py-3 border-t border-[hsl(240_20%_85%/0.07)]">
          <Button
            size="sm"
            className="w-full bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50"
            onClick={() =>
              addCreatureMutation.mutate({
                planId: currentPlanId,
                name: monster.name,
                count: 1,
                cr: String((monster.data as any)?.cr ?? ''),
                xp: (monster.data as any)?.xp ?? undefined,
                sourceType: 'homebrew',
                sourceId: monster.id,
                statBlock: monster.data as Record<string, unknown>,
              })
            }
            disabled={addCreatureMutation.isPending}
          >
            Add to Encounter
          </Button>
        </div>
      )}
    </div>
  );
}

type ChapterItemData = {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
};

function ChapterDetail({ chapterId }: { chapterId: string }) {
  const { campaignId } = useRouteContext();
  const { data: result } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId ?? undefined, type: 'location' },
    { enabled: !!campaignId }
  );
  const chapter = (result?.items ?? []).find((c: any) => c.id === chapterId) as ChapterItemData | undefined;

  if (!chapter) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  const data = chapter.data as any;
  const prose: string = data?.prose ?? '';
  const lastSpace = prose.lastIndexOf(' ', 800);
  const truncated = prose.length > 800
    ? (lastSpace > 0 ? prose.slice(0, lastSpace) : prose.slice(0, 800)) + '…'
    : prose;
  const encounterAreas: string[] = data?.encounterAreas ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3 space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground mb-1">{chapter.name}</h3>
      </div>
      {truncated && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Excerpt</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{truncated}</p>
        </div>
      )}
      {encounterAreas.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Encounter Areas</p>
          <ul className="space-y-1">
            {encounterAreas.map((area: string) => (
              <li key={area} className="text-xs text-foreground/70 px-2.5 py-1.5 rounded bg-[hsl(240_10%_10%/0.5)] border border-[hsl(240_20%_85%/0.06)]">
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DetailPane() {
  const { selectedItemId, selectedItemType } = useCompendiumStore();

  if (!selectedItemId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-2">
        <p className="font-display text-sm" style={{ color: 'hsl(35 30% 38%)' }}>Select an entry</p>
        <p className="text-xs text-muted-foreground/40 leading-relaxed">Choose an encounter, monster, or chapter from the list to view details.</p>
      </div>
    );
  }

  if (selectedItemType === 'encounter') {
    return <EncounterDetail planId={selectedItemId} />;
  }

  if (selectedItemType === 'monster') {
    return <MonsterDetail monsterId={selectedItemId} />;
  }

  if (selectedItemType === 'chapter') {
    return <ChapterDetail chapterId={selectedItemId} />;
  }

  return null;
}
