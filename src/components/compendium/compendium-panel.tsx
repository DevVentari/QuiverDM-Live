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
        side="left"
        className="p-0 border-r border-[hsl(35_35%_18%)] w-[700px] max-w-[95vw] flex flex-row z-50"
      >
        {/* Left pane: tabs + list */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-[hsl(240_20%_85%/0.07)] h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[hsl(240_20%_85%/0.07)]">
            <p className="text-[10px] font-display tracking-[0.15em] text-[var(--card-amber)] uppercase">Compendium</p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[hsl(240_20%_85%/0.07)] px-2 pt-2 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t transition-colors',
                  activeTab === tab.id
                    ? 'bg-[hsl(240_10%_14%)] text-[var(--card-amber)] border border-b-0 border-[hsl(240_20%_85%/0.12)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
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
