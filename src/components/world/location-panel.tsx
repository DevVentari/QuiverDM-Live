'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';
import {
  Map, Brain, User, ChevronDown, ChevronRight, Swords,
  Users, Shield, Package, Zap, BookOpen, Skull, Lock, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

function formatEventValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return String(value);
  const v = value as Record<string, unknown>;
  if (typeof v.content === 'string') return v.content;
  const parts: string[] = [];
  if (v.name) parts.push(String(v.name));
  if (v.status) parts.push(`status changed to ${String(v.status)}`);
  if (v.type) parts.push(`(${String(v.type).toLowerCase()})`);
  return parts.length > 0 ? parts.join(' — ') : 'Updated location';
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NPC: Users,
  PC: User,
  FACTION: Shield,
  LOCATION: MapPin,
  ITEM: Package,
  EVENT: Zap,
  ARC: BookOpen,
  THREAT: Skull,
  SECRET: Lock,
  CUSTOM: User,
  NOTE: BookOpen,
};

function EntityPill({ name, type }: { name: string; type: string }) {
  const Icon = ENTITY_ICONS[type] ?? User;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2 py-0.5 text-[11px] text-amber-100/80">
      <Icon className="h-3 w-3 shrink-0 text-amber-400/60" />
      {name}
    </span>
  );
}

interface LocationPanelProps {
  entityId: string;
  entityName: string;
  initialFoundrySceneId?: string | null;
  campaignId: string;
  mapId: string;
  slug: string;
  onClose: () => void;
}

export function LocationPanel({
  entityId,
  entityName,
  initialFoundrySceneId,
  campaignId,
  mapId,
  slug,
  onClose,
}: LocationPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [foundrySceneId, setLocalFoundrySceneId] = useState<string | null>(initialFoundrySceneId ?? null);
  const [sceneInput, setSceneInput] = useState('');
  const [eventsOpen, setEventsOpen] = useState(true);

  const detailQuery = trpc.worldMap.getLocationDetail.useQuery({ entityId, campaignId });
  const eventsQuery = trpc.worldMap.getLocationEvents.useQuery({ entityId, campaignId });

  const addNoteMutation = trpc.worldMap.addLocationNote.useMutation({
    onSuccess: () => {
      setNote('');
      void eventsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const createSubMapMutation = trpc.worldMap.createSubMap.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${slug}/world-map?map=${data.id}`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  const activateScene = trpc.foundry.activateScene.useMutation({
    onSuccess: () => toast.success('Battle map activated in Foundry'),
    onError: (err) => toast.error(err.message),
  });
  const setFoundryScene = trpc.worldMap.setFoundryScene.useMutation({
    onSuccess: (_, vars) => {
      setLocalFoundrySceneId(vars.foundrySceneId);
      setSceneInput('');
      toast.success('Scene linked');
    },
    onError: (err) => toast.error(err.message),
  });

  const entity = detailQuery.data;
  const events = eventsQuery.data ?? [];

  const linkedEntities = [
    ...(entity?.fromRelationships ?? []).map((r) => ({ ...r.toEntity, relType: r.type })),
    ...(entity?.toRelationships ?? []).map((r) => ({ ...r.fromEntity, relType: r.type })),
  ];
  const sessions = entity?.sessionAppearances ?? [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-[400px] flex-col overflow-hidden border-l border-border bg-card p-0"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-amber-500/10 bg-[linear-gradient(180deg,hsl(240_14%_12%/.96),hsl(240_12%_8%/.98))] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/55">Location</p>
          <SheetTitle className="mt-1 font-display text-base text-amber-50">{entityName}</SheetTitle>
          {entity && (
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-500/20 bg-amber-500/[0.05] text-[10px] uppercase tracking-wider text-amber-200/60"
              >
                {entity.type.toLowerCase()}
              </Badge>
              {entity.status !== 'active' && (
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/40"
                >
                  {entity.status.toLowerCase()}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-0 overflow-y-auto bg-[linear-gradient(180deg,hsl(238_15%_10%),hsl(240_12%_7%))]">

          {/* Hero image */}
          {entity?.imageUrl && (
            <div className="h-40 w-full shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entity.imageUrl}
                alt={entity.name}
                className="h-full w-full object-cover opacity-80"
              />
            </div>
          )}

          {/* Description */}
          {entity?.description && (
            <div className="border-b border-white/[0.04] px-5 py-4">
              <p className="text-sm leading-relaxed text-amber-50/75">{entity.description}</p>
            </div>
          )}

          {/* Connected entities */}
          {linkedEntities.length > 0 && (
            <div className="border-b border-white/[0.04] px-5 py-4">
              <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/40">Connected</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedEntities.map((e) => (
                  <EntityPill key={`${e.id}-${e.relType}`} name={e.name} type={e.type} />
                ))}
              </div>
            </div>
          )}

          {/* Session appearances */}
          {sessions.length > 0 && (
            <div className="border-b border-white/[0.04] px-5 py-4">
              <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/40">Appeared In</p>
              <div className="flex flex-col gap-1">
                {sessions.map((a) => (
                  <span key={a.id} className="text-[12px] text-amber-100/60">
                    {a.session.title ?? `Session ${a.session.sessionNumber}`}
                    {a.role && <span className="ml-1.5 text-amber-100/35">· {a.role}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chronicle (collapsible) */}
          <div className="border-b border-white/[0.04]">
            <button
              type="button"
              onClick={() => setEventsOpen((o) => !o)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-amber-200/40">Chronicle</span>
              <span className="flex items-center gap-1 text-[11px] text-amber-100/30">
                {events.length > 0 && <span>{events.length}</span>}
                {eventsOpen
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
              </span>
            </button>

            {eventsOpen && (
              <div className="flex flex-col gap-3 px-5 pb-4">
                {events.length === 0 && (
                  <p className="text-sm text-amber-100/35">
                    No events yet. Play a session to see history gather around this place.
                  </p>
                )}
                {events.map((event) => {
                  const isBrain = event.source === 'ingestion' || event.source === 'inference';
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                        {isBrain
                          ? <Brain className="h-3 w-3 text-[hsl(258_60%_65%)]" />
                          : <User className="h-3 w-3 text-amber-400" />
                        }
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm leading-snug text-amber-50/85">
                          {formatEventValue(event.newValue)}
                        </p>
                        <div className="flex items-center gap-2">
                          {event.session && (
                            <Badge
                              variant="outline"
                              className="h-4 border-amber-500/20 bg-amber-500/[0.05] px-1 text-[10px] text-amber-100/60"
                            >
                              {event.session.title ?? `Session ${event.session.sessionNumber}`}
                            </Badge>
                          )}
                          <span className="text-[11px] text-amber-100/35">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add note */}
          <div className="border-b border-white/[0.04] px-5 py-4">
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Add a note about this location…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[72px] resize-none border-amber-500/15 bg-white/[0.03] text-sm text-amber-50 placeholder:text-amber-100/30"
              />
              <Button
                size="sm"
                disabled={!note.trim() || addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate({ entityId, campaignId, content: note.trim() })}
              >
                Add note
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 px-5 py-4">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-full gap-2 border-amber-500/20 bg-amber-500/[0.04] text-amber-100',
                'hover:bg-amber-500/[0.08]',
              )}
              disabled={createSubMapMutation.isPending}
              onClick={() =>
                createSubMapMutation.mutate({
                  parentLocationEntityId: entityId,
                  campaignId,
                  name: 'Location Map',
                })
              }
            >
              <Map className="h-4 w-4" />
              Open sub-map
            </Button>

            {foundrySceneId ? (
              <button
                type="button"
                onClick={() => activateScene.mutate({ campaignId, foundrySceneId })}
                disabled={activateScene.isPending}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-sm px-3 py-2',
                  'border border-red-500/30 bg-red-500/[0.06] text-[11px] uppercase tracking-[2px] text-red-300',
                  'transition-colors hover:bg-red-500/[0.12] disabled:opacity-50',
                )}
              >
                <Swords className="h-3.5 w-3.5" />
                Start combat here
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-amber-100/35">
                  Link a Foundry scene to enable one-click combat launch.
                </p>
                <input
                  type="text"
                  placeholder="Paste Foundry scene ID…"
                  value={sceneInput}
                  onChange={(e) => setSceneInput(e.target.value)}
                  className={cn(
                    'w-full rounded-sm border border-amber-500/15 bg-white/[0.03]',
                    'px-2 py-1.5 text-[11px] text-amber-50 placeholder:text-amber-100/30',
                    'focus:outline-none focus:ring-1 focus:ring-amber-500/30',
                  )}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const val = sceneInput.trim();
                    if (val) setFoundryScene.mutate({ campaignId, entityId, foundrySceneId: val });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
