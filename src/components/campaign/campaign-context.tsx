'use client';

import { createContext, useContext } from 'react';

interface CampaignContextValue {
  campaignId: string;
  slug: string;
  name: string;
  role?: string;
  isOwner: boolean;
  isDM: boolean;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({
  value,
  children,
}: {
  value: CampaignContextValue;
  children: React.ReactNode;
}) {
  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used within CampaignProvider');
  return ctx;
}
