'use client';

import { trpc } from '@/lib/trpc';
import { useParams } from 'next/navigation';
import { CampaignProvider } from '@/components/campaign/campaign-context';

/**
 * v3 campaign-scoped layout. Resolves the campaign from the slug and provides
 * the existing CampaignProvider so every v3 screen below uses `useCampaign()`
 * ({ campaignId, slug, isDM, … }) exactly like the live (app). Styled on --qd-*.
 */
export default function V3CampaignLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const campaign = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 120_000 });

  if (campaign.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-qd-ink-muted">
        Gathering the chronicle…
      </div>
    );
  }

  if (campaign.error || !campaign.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-qd-display text-2xl text-qd-ink-strong">No such world</p>
        <p className="text-qd-ink-muted">This campaign doesn&apos;t exist, or you don&apos;t have access.</p>
        <a href="/v3" className="text-qd-accent-text hover:underline">← All campaigns</a>
      </div>
    );
  }

  const data = campaign.data as any;
  const role = data.myRole || data.myPermissions?.role || 'PLAYER';
  const isDM = role === 'OWNER' || role === 'CO_DM';

  return (
    <CampaignProvider
      value={{
        campaignId: data.id,
        slug,
        name: data.name,
        role,
        isOwner: role === 'OWNER',
        isDM,
      }}
    >
      {children}
    </CampaignProvider>
  );
}
