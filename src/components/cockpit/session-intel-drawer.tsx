'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { NpcsPanel } from '@/components/cockpit/session-intel/npcs-panel';
import { SecretsPanel } from '@/components/cockpit/session-intel/secrets-panel';
import { RoutesPanel } from '@/components/cockpit/session-intel/routes-panel';
import { PhasesPanel } from '@/components/cockpit/session-intel/phases-panel';
import { BriefPanel } from '@/components/cockpit/session-intel/brief-panel';

type TabId = 'npcs' | 'secrets' | 'routes' | 'phases' | 'brief';

interface SessionIntelDrawerProps {
  campaignId: string;
  sessionId: string;
  intentBrief?: { toneKeywords: string[]; playerGoals: string[]; dmOnlyTruths: string[] } | null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'npcs', label: 'NPCs' },
  { id: 'secrets', label: 'SECRETS' },
  { id: 'routes', label: 'ROUTES' },
  { id: 'phases', label: 'PHASES' },
  { id: 'brief', label: 'BRIEF' },
];

const PANEL_TITLES: Record<TabId, string> = {
  npcs: 'NPCs',
  secrets: 'Secrets Web',
  routes: 'Escape Routes',
  phases: 'Phase Pacing',
  brief: 'Session Brief',
};

export function SessionIntelDrawer({ campaignId, sessionId, intentBrief }: SessionIntelDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  function toggle(id: TabId) {
    setActiveTab(prev => (prev === id ? null : id));
  }

  return (
    <div className="relative flex shrink-0 h-full">
      {activeTab && (
        <div className="absolute inset-y-0 right-8 w-56 z-20 bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {PANEL_TITLES[activeTab]}
            </span>
            <button onClick={() => setActiveTab(null)} aria-label="Close panel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'npcs' && (
              <NpcsPanel campaignId={campaignId} sessionId={sessionId} />
            )}
            {activeTab === 'secrets' && (
              <SecretsPanel campaignId={campaignId} sessionId={sessionId} />
            )}
            {activeTab === 'routes' && (
              <RoutesPanel campaignId={campaignId} sessionId={sessionId} />
            )}
            {activeTab === 'phases' && (
              <PhasesPanel campaignId={campaignId} sessionId={sessionId} />
            )}
            {activeTab === 'brief' && (
              <BriefPanel intentBrief={intentBrief} />
            )}
          </div>
        </div>
      )}
      <div className="w-8 border-l border-border bg-muted/10 flex flex-col items-center pt-3 gap-1.5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => toggle(tab.id)}
            style={{ writingMode: 'vertical-lr' }}
            aria-label={tab.label}
            className={cn(
              'text-[9px] font-medium tracking-widest px-0.5 py-2 rounded-sm transition-colors',
              activeTab === tab.id
                ? 'bg-primary/15 text-primary border-l-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
