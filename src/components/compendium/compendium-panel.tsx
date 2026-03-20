'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';
import { EncountersTab } from './encounters-tab';
import { MonstersTab } from './monsters-tab';
import { ChaptersTab } from './chapters-tab';
import { ItemsTab } from './items-tab';
import { DetailPane } from './detail-pane';

const TABS = [
  { id: 'encounters', label: 'Encounters' },
  { id: 'monsters',   label: 'Monsters' },
  { id: 'chapters',   label: 'Chapters' },
  { id: 'items',      label: 'Items' },
] as const;

export function CompendiumPanel() {
  const { isOpen, close, activeTab, setTab } = useCompendiumStore();

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && close()}>
      <SheetContent
        side="right"
        className="p-0 border-l border-[hsl(35_35%_18%)] w-[700px] max-w-[95vw] flex flex-row z-50"
      >
        {/* Left pane: tabs + list */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-[hsl(240_20%_85%/0.07)] h-full">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[hsl(240_20%_85%/0.07)]">
            <p className="text-[10px] font-sans tracking-[0.18em] text-muted-foreground/50 uppercase mb-0.5">Sourcebook</p>
            <p className="font-display text-sm font-semibold tracking-wide" style={{ color: 'hsl(35 80% 62%)', textShadow: '0 0 12px hsl(35 80% 48% / 0.25)' }}>Compendium</p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[hsl(240_20%_85%/0.07)] px-3 gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  'relative px-3 py-2.5 text-xs transition-colors',
                  activeTab === tab.id
                    ? 'text-[var(--card-amber)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 6px hsl(35 80% 48% / 0.5)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'encounters' && <EncountersTab />}
            {activeTab === 'monsters'   && <MonstersTab />}
            {activeTab === 'chapters'   && <ChaptersTab />}
            {activeTab === 'items'      && <ItemsTab />}
          </div>
        </div>

        {/* Right pane: detail */}
        <div className="flex-1 overflow-hidden">
          <DetailPane />
        </div>
      </SheetContent>
    </Sheet>
  );
}
