import { useEffect } from 'react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useHeaderStore } from '@/store/header-store';
import type { HeaderStat } from '@/store/header-store';

export function useCampaignPageSlot(pageTitle: string, stats?: HeaderStat[]) {
  const { name, campaignId, slug, isDM } = useCampaign();
  const setSlot = useHeaderStore((s) => s.setSlot);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const statsKey = stats ? JSON.stringify(stats) : undefined;

  useEffect(() => {
    setSlot({ label: pageTitle, title: name, campaignId, campaignSlug: slug, isDM, stats });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTitle, name, campaignId, slug, isDM, statsKey, setSlot]);
}
