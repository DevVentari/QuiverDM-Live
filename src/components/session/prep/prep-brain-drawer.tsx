'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const URGENCY_COLORS: Record<string, string> = {
  high: 'border-red-500/40 text-red-400 bg-red-500/10',
  medium: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
  low: 'border-stone-500/30 text-stone-400 bg-stone-500/10',
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  NPC: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  FACTION: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  LOCATION: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  ITEM: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  EVENT: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  THREAT: 'border-red-500/30 text-red-400 bg-red-500/10',
  CONCEPT: 'border-stone-500/30 text-stone-400 bg-stone-500/10',
};

interface PrepBrainDrawerProps {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-display font-semibold tracking-widest uppercase mb-3"
      style={{ color: 'hsl(35 70% 55%)' }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t my-5" style={{ borderColor: 'hsl(35 30% 20% / 0.4)' }} />;
}

export function PrepBrainDrawer({ campaignId, open, onClose }: PrepBrainDrawerProps) {
  const { data: state, isLoading: stateLoading } = trpc.brain.state.get.useQuery(
    { campaignId },
    { enabled: open, retry: false }
  );
  const { data: timeline, isLoading: timelineLoading } = trpc.brain.timeline.useQuery(
    { campaignId, limit: 20 },
    { enabled: open, retry: false }
  );

  const isLoading = stateLoading || timelineLoading;

  const hooks = Array.isArray(state?.hooks)
    ? (state.hooks as Array<{
        id?: string;
        text: string;
        urgency: string;
        status?: string;
        ageInSessions?: number;
        linkedEntityNames?: string[];
      }>)
        .filter((h) => h.status === 'open' || !h.status)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.urgency as keyof typeof order] ?? 2) - (order[b.urgency as keyof typeof order] ?? 2);
        })
    : [];

  const recentChanges = (() => {
    if (!timeline) return [];
    const seen = new Map<string, (typeof timeline)[number]>();
    for (const change of timeline) {
      if (change.entityId && !seen.has(change.entityId)) {
        seen.set(change.entityId, change);
      }
    }
    return [...seen.values()].slice(0, 8);
  })();

  const pressureTracks = state
    ? [
        { name: 'Political', value: state.pressurePolitical },
        { name: 'Supernatural', value: state.pressureSupernatural },
        { name: 'Economic', value: state.pressureEconomic },
        { name: 'Cosmic', value: state.pressureCosmic },
        { name: 'Social', value: state.pressureSocial },
      ].filter((t) => t.value > 0.7)
    : [];

  const notSeeded = !isLoading && !state;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-96 max-w-full flex flex-col overflow-y-auto"
        style={{
          background: 'hsl(240 10% 9%)',
          borderColor: 'hsl(35 30% 20% / 0.4)',
        }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display text-base" style={{ color: 'hsl(35 70% 70%)' }}>
            DM Brain
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <p className="text-xs" style={{ color: 'hsl(35 10% 45%)' }}>Loading brain data…</p>
        )}

        {notSeeded && (
          <div
            className="rounded-sm border px-4 py-6 text-center"
            style={{ borderColor: 'hsl(35 30% 20% / 0.4)', background: 'hsl(240 10% 11%)' }}
          >
            <p className="text-sm" style={{ color: 'hsl(35 10% 50%)' }}>
              No brain data yet. Seed the brain from the Brain page.
            </p>
          </div>
        )}

        {state && (
          <>
            {/* Open Hooks */}
            <div>
              <SectionHeading>Open Hooks</SectionHeading>
              {hooks.length === 0 ? (
                <p className="text-xs" style={{ color: 'hsl(35 10% 40%)' }}>No open hooks.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {hooks.map((hook, i) => (
                    <div
                      key={hook.id ?? i}
                      className="rounded-sm border px-3 py-2.5"
                      style={{
                        background: 'hsl(240 10% 11%)',
                        borderColor: 'hsl(35 30% 20% / 0.4)',
                      }}
                    >
                      <p className="text-xs mb-1.5" style={{ color: 'hsl(35 15% 80%)' }}>
                        {hook.text}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1.5 py-0', URGENCY_COLORS[hook.urgency] ?? URGENCY_COLORS.low)}
                        >
                          {hook.urgency}
                        </Badge>
                        {hook.ageInSessions != null && hook.ageInSessions > 0 && (
                          <span className="text-[10px]" style={{ color: 'hsl(35 10% 40%)' }}>
                            {hook.ageInSessions} session{hook.ageInSessions !== 1 ? 's' : ''} old
                          </span>
                        )}
                        {hook.linkedEntityNames?.map((name) => (
                          <span
                            key={name}
                            className="text-[10px] px-1.5 py-0.5 rounded-sm border"
                            style={{ borderColor: 'hsl(35 30% 25% / 0.5)', color: 'hsl(35 15% 60%)' }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Recent Entity Changes */}
            <div>
              <SectionHeading>Recent Entity Changes</SectionHeading>
              {recentChanges.length === 0 ? (
                <p className="text-xs" style={{ color: 'hsl(35 10% 40%)' }}>No recent changes.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentChanges.map((change) => (
                    <div key={change.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium" style={{ color: 'hsl(35 15% 80%)' }}>
                            {change.entity?.name ?? 'Unknown'}
                          </span>
                          {change.entity?.type && (
                            <Badge
                              variant="outline"
                              className={cn('text-[9px] px-1 py-0', ENTITY_TYPE_COLORS[change.entity.type] ?? '')}
                            >
                              {change.entity.type.toLowerCase()}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'hsl(35 10% 42%)' }}>
                          {change.changeType.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pressureTracks.length > 0 && (
              <>
                <Divider />
                <div>
                  <SectionHeading>Pressure Warnings</SectionHeading>
                  <div className="flex flex-col gap-1.5">
                    {pressureTracks.map((track) => (
                      <p key={track.name} className="text-xs" style={{ color: 'hsl(35 70% 60%)' }}>
                        {track.name} pressure is elevated ({track.value.toFixed(2)})
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
