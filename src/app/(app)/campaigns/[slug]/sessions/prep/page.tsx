'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PrepWizard } from '@/components/session/prep/prep-wizard';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { SessionPrepDataSchema, emptyPrepData } from '@/lib/prep-types';

function PrepPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { campaignId } = useCampaign();
  const createdRef = useRef(false);

  const sessionId = searchParams.get('sessionId');

  const createPrepSession = trpc.sessions.createPrepSession.useMutation({
    onSuccess: (session) => {
      router.replace(`/campaigns/${slug}/sessions/prep?sessionId=${session.id}`);
    },
  });

  useEffect(() => {
    if (!campaignId || sessionId || createdRef.current) return;
    createdRef.current = true;
    createPrepSession.mutate({ campaignId });
  }, [campaignId, sessionId, createPrepSession]);

  const contextQuery = trpc.sessions.getPrepContext.useQuery(
    { campaignId },
    { enabled: !!campaignId }
  );

  const sessionQuery = trpc.sessions.getById.useQuery(
    { id: sessionId ?? '' },
    { enabled: !!sessionId }
  );

  const initialData = useMemo(() => {
    const parsed = SessionPrepDataSchema.safeParse((sessionQuery.data as any)?.prepData);
    const base = parsed.success ? parsed.data : emptyPrepData();

    if (base.characterNotes.length > 0) return base;

    const characters = (contextQuery.data?.characters ?? []) as Array<{ id: string; name: string }>;
    return {
      ...base,
      characterNotes: characters.map((character) => ({
        characterId: character.id,
        name: character.name,
        goals: '',
        notes: '',
      })),
    };
  }, [sessionQuery.data, contextQuery.data]);

  const isLoading =
    createPrepSession.isPending ||
    !sessionId ||
    contextQuery.isLoading ||
    sessionQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!sessionQuery.data || !contextQuery.data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Unable to load prep data.
      </div>
    );
  }

  return (
    <PrepWizard
      sessionId={sessionId}
      initialData={initialData}
      campaignContext={contextQuery.data as any}
      slug={slug}
      initialTitle={(sessionQuery.data as any).title ?? 'Session'}
      prepStatus={(sessionQuery.data as any).prepStatus ?? 'draft'}
    />
  );
}

export default function SessionPrepPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <PrepPageInner />
    </Suspense>
  );
}
