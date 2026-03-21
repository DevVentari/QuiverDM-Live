'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

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

interface PrepBrainContextCardProps {
  campaignId: string;
}

export function PrepBrainContextCard({ campaignId }: PrepBrainContextCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: state } = trpc.brain.state.get.useQuery({ campaignId }, { retry: false });
  const { data: timeline } = trpc.brain.timeline.useQuery({ campaignId, limit: 20 }, { retry: false });

  if (!state) return null;

  const recentChanges = (timeline ?? []).slice(0, 3).filter((c) => c.entity);
  const hooks = Array.isArray(state.hooks)
    ? (state.hooks as Array<{ text: string; urgency: string; status?: string }>)
        .filter((h) => h.status === 'open' || !h.status)
        .slice(0, 2)
    : [];

  const pressureTracks = [
    { name: 'Political', value: state.pressurePolitical },
    { name: 'Supernatural', value: state.pressureSupernatural },
    { name: 'Economic', value: state.pressureEconomic },
    { name: 'Cosmic', value: state.pressureCosmic },
    { name: 'Social', value: state.pressureSocial },
  ].filter((t) => t.value > 0.7);

  const hasContent = recentChanges.length > 0 || hooks.length > 0 || pressureTracks.length > 0;
  if (!hasContent) return null;

  const summary = [
    recentChanges.length > 0 && `${recentChanges.length} ${recentChanges.length === 1 ? 'entity' : 'entities'} changed`,
    hooks.length > 0 && `${hooks.length} new ${hooks.length === 1 ? 'hook' : 'hooks'}`,
    pressureTracks.length > 0 && `${pressureTracks.length} pressure elevated`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="rounded-sm border overflow-hidden cursor-pointer select-none"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
        borderColor: 'hsl(35 60% 30% / 0.4)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08)',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[10px] font-display font-semibold tracking-widest uppercase shrink-0"
            style={{ color: 'hsl(35 70% 55%)' }}
          >
            Brain · Last Session
          </span>
          <span className="text-xs truncate" style={{ color: 'hsl(35 10% 50%)' }}>
            {summary}
          </span>
        </div>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expanded && 'rotate-180')}
          style={{ color: 'hsl(35 10% 40%)' }}
        />
      </div>

      {expanded && (
        <div
          className="px-5 pb-4 pt-1 border-t grid grid-cols-3 gap-4"
          style={{ borderColor: 'hsl(35 30% 20% / 0.3)' }}
        >
          {/* Changed entities */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(35 10% 40%)' }}>
              Changed
            </p>
            {recentChanges.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {recentChanges.map((change) => (
                  <div key={change.id} className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'hsl(35 15% 75%)' }}>
                      {change.entity?.name ?? '—'}
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
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'hsl(35 10% 35%)' }}>None</p>
            )}
          </div>

          {/* New hooks */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(35 10% 40%)' }}>
              New Hooks
            </p>
            {hooks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {hooks.map((hook, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="text-xs line-clamp-1" style={{ color: 'hsl(35 15% 75%)' }}>
                      {hook.text.length > 40 ? hook.text.slice(0, 40) + '…' : hook.text}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[9px] px-1 py-0 w-fit', URGENCY_COLORS[hook.urgency] ?? URGENCY_COLORS.low)}
                    >
                      {hook.urgency}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'hsl(35 10% 35%)' }}>None</p>
            )}
          </div>

          {/* Pressure tracks */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(35 10% 40%)' }}>
              Pressure
            </p>
            {pressureTracks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {pressureTracks.map((track) => (
                  <p key={track.name} className="text-xs" style={{ color: 'hsl(35 70% 60%)' }}>
                    {track.name} ↑ {track.value.toFixed(2)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'hsl(35 10% 35%)' }}>None elevated</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
