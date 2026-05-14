'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { Activity, CheckSquare, MapPin, Scroll, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import type { SessionPrepData } from '@/lib/prep-types';

interface Pin {
  id: string;
  x: number;
  y: number;
  lastEventAt?: string | Date | null;
  entity: { id: string; name: string; type: string };
}

interface WorldMapOverlayProps {
  campaignId: string;
  slug: string;
  selectedEntityId: string | null;
  selectedEntityName: string;
  locationPins: Pin[];
  onSelectLocation: (entityId: string, name: string) => void;
}

function CardShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute pointer-events-auto rounded-[1.1rem] border',
        'bg-[linear-gradient(180deg,var(--wm-raised),var(--wm-surface))]',
        'shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md p-3',
        className,
      )}
      style={{
        borderColor: 'var(--wm-border)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 color-mix(in oklab, var(--wm-text) 6%, transparent)',
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  href,
  icon,
}: {
  title: string;
  href?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md border text-[var(--wm-accent)]"
            style={{
              borderColor: 'var(--wm-accent-border)',
              background: 'var(--wm-accent-trace)',
            }}
          >
            {icon}
          </span>
        )}
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--wm-muted)' }}>
          {title}
        </p>
      </div>
      {href && (
        <Link
          href={href}
          className="text-[9px] uppercase tracking-[0.14em] transition-colors hover:opacity-90"
          style={{ color: 'var(--wm-accent)' }}
        >
          View all -&gt;
        </Link>
      )}
    </div>
  );
}

function AvatarInitial({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full border font-display font-semibold',
        sz,
      )}
      style={{
        borderColor: 'var(--wm-accent-border)',
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--wm-surface) 88%, var(--wm-accent) 12%), var(--wm-surface))',
        color: 'var(--wm-accent)',
      }}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function SectionIcon({ icon, tone = 'var(--wm-accent)' }: { icon: ReactNode; tone?: string }) {
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-lg border"
      style={{
        borderColor: 'color-mix(in oklab, var(--wm-accent) 34%, var(--wm-border))',
        background: 'color-mix(in oklab, var(--wm-surface) 82%, var(--wm-accent) 18%)',
        color: tone,
      }}
    >
      {icon}
    </div>
  );
}

function formatSessionDate(date?: string | Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SessionCard({ campaignId, slug }: { campaignId: string; slug: string }) {
  const { data: campaign } = trpc.campaigns.getBySlug.useQuery({ slug });
  const { data: sessions } = trpc.sessions.getAll.useQuery({ campaignId });

  const nextSession = useMemo(() => {
    const ordered = [...(sessions ?? [])].sort((a, b) => {
      const aDate = new Date((a.date ?? a.createdAt) as string | Date).getTime();
      const bDate = new Date((b.date ?? b.createdAt) as string | Date).getTime();
      return aDate - bDate;
    });
    return ordered.find((session) => session.status === 'planned' || session.status === 'planning') ?? ordered[0];
  }, [sessions]);

  return (
    <CardShell className="left-[calc(var(--q-rail-collapsed-w)+1rem)] top-5 z-10 w-56">
      <p className="mb-0.5 font-display text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--wm-muted)' }}>
        Campaign
      </p>
      <p className="mb-2 line-clamp-2 font-display text-sm font-semibold leading-tight" style={{ color: 'var(--wm-text)' }}>
        {campaign?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </p>
      <div className="mb-2.5 h-px bg-gradient-to-r from-[var(--wm-accent-border)] to-transparent" />
      {nextSession ? (
        <>
          <p className="mb-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--wm-accent)' }}>
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 align-middle rounded-full"
              style={{ backgroundColor: 'var(--wm-accent)', boxShadow: '0 0 5px var(--wm-glow)' }}
            />
            Next Session
          </p>
          <p className="mb-1.5 line-clamp-2 font-display text-[13px] font-semibold leading-tight" style={{ color: 'var(--wm-text)' }}>
            {nextSession.title ?? `Session ${nextSession.sessionNumber}`}
          </p>
          <p className="mb-0.5 text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
            Session {nextSession.sessionNumber}
            {formatSessionDate(nextSession.date) ? ` · ${formatSessionDate(nextSession.date)}` : ''}
          </p>
          <p className="mb-3 text-[10px]" style={{ color: 'var(--wm-muted)' }}>
            {nextSession.status === 'in_progress' ? 'Currently running' : 'Scheduled'}
          </p>
          <Link
            href={`/campaigns/${slug}/sessions/${nextSession.id}`}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border px-3 font-display text-[10px] font-semibold tracking-[0.1em] transition-colors hover:opacity-90"
            style={{
              borderColor: 'var(--wm-accent-border)',
              background: 'var(--wm-accent-trace)',
              color: 'var(--wm-accent)',
            }}
          >
            Open Session -&gt;
          </Link>
        </>
      ) : (
        <p className="py-2 text-center text-[11px]" style={{ color: 'var(--wm-muted)' }}>No session scheduled</p>
      )}
    </CardShell>
  );
}

function NpcCard({
  campaignId,
  slug,
  selectedEntityName,
}: {
  campaignId: string;
  slug: string;
  selectedEntityName: string;
}) {
  const { data: npcs } = trpc.npcs.getAll.useQuery({ campaignId });

  const displayed = useMemo(() => {
    if (!npcs) return [];
    const scope = selectedEntityName.trim().toLowerCase();
    const sorted = [...npcs].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    if (scope) {
      const filtered = sorted.filter((npc) => {
        const haystack = [
          npc.name,
          npc.description ?? '',
          npc.faction ?? '',
          npc.role ?? '',
          ...(Array.isArray(npc.tags) ? npc.tags : []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(scope);
      });
      if (filtered.length > 0) return filtered.slice(0, 4);
    }
    return sorted.slice(0, 4);
  }, [npcs, selectedEntityName]);

  return (
    <CardShell className="right-5 top-5 z-10 w-52">
      <SectionHeader title="NPCs" href={`/campaigns/${slug}/npcs`} />
      <div className="space-y-1.5">
        {displayed.map((npc) => (
          <div key={npc.id} className="flex items-center gap-2.5 border-b border-[color:color-mix(in_oklab,var(--wm-border)_56%,transparent)] py-1 last:border-0">
            <AvatarInitial name={npc.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" style={{ color: 'var(--wm-text)' }}>
                {npc.name}
              </p>
              <p className="truncate text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
                {npc.role ?? npc.faction ?? 'Unknown'}
              </p>
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <p className="py-2 text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No NPCs yet</p>
        )}
      </div>
    </CardShell>
  );
}

function QuestCard({
  campaignId,
  selectedEntityName,
}: {
  campaignId: string;
  selectedEntityName: string;
}) {
  const { data: plans } = trpc.encounterPlans.getByCampaign.useQuery({ campaignId });

  const displayed = useMemo(() => {
    const allPlans = plans ?? [];
    const scope = selectedEntityName.trim().toLowerCase();
    const sorted = [...allPlans].sort((a, b) => {
      const aTime = new Date((a.updatedAt ?? a.createdAt) as string | Date).getTime();
      const bTime = new Date((b.updatedAt ?? b.createdAt) as string | Date).getTime();
      return bTime - aTime;
    });

    if (scope) {
      const filtered = sorted.filter((plan) => {
        const haystack = [plan.name, plan.sceneDescription ?? '', plan.tacticalNotes ?? '']
          .join(' ')
          .toLowerCase();
        return haystack.includes(scope);
      });
      if (filtered.length > 0) return filtered.slice(0, 3);
    }

    return sorted.slice(0, 3);
  }, [plans, selectedEntityName]);

  const statusTone = (difficulty?: string | null) => {
    if (!difficulty) return 'var(--wm-muted)';
    if (['hard', 'deadly'].includes(difficulty)) return 'var(--wm-accent)';
    if (difficulty === 'medium') return 'var(--wm-soft-text)';
    return 'var(--wm-muted)';
  };

  const statusLabel = (difficulty?: string | null) => {
    if (!difficulty) return 'Unknown';
    if (['hard', 'deadly'].includes(difficulty)) return 'Active Threat';
    if (difficulty === 'medium') return 'In Progress';
    return 'Minor';
  };

  return (
    <CardShell className="right-5 top-[230px] z-10 w-52 max-[900px]:hidden">
      <SectionHeader title="Quests" icon={<Scroll className="h-3 w-3" />} />
      <div className="space-y-1.5">
        {displayed.map((plan) => (
          <div key={plan.id} className="flex items-start gap-2 border-b border-[color:color-mix(in_oklab,var(--wm-border)_56%,transparent)] py-1 last:border-0">
            <SectionIcon icon={<Scroll className="h-3 w-3" />} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-medium" style={{ color: 'var(--wm-text)' }}>{plan.name}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: statusTone(plan.difficulty) }}>
                {statusLabel(plan.difficulty)}
              </p>
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <p className="py-2 text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No encounters yet</p>
        )}
      </div>
    </CardShell>
  );
}

function LocationsCard({
  locationPins,
  slug,
  selectedEntityId,
  onSelectLocation,
}: {
  locationPins: Pin[];
  slug: string;
  selectedEntityId: string | null;
  onSelectLocation: (entityId: string, name: string) => void;
}) {
  const displayed = useMemo(
    () =>
      [...locationPins]
        .filter((pin) => pin.entity.type === 'LOCATION')
        .sort((a, b) => {
          const aTime = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0;
          const bTime = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 3),
    [locationPins],
  );

  return (
    <CardShell className="bottom-5 left-[calc(var(--q-rail-collapsed-w)+1rem)] z-10 w-52 max-[900px]:hidden">
      <SectionHeader
        title="Recent Locations"
        href={`/campaigns/${slug}/world`}
        icon={<MapPin className="h-3 w-3" />}
      />
      <div className="space-y-1.5">
        {displayed.map((pin) => {
          const isSelected = pin.entity.id === selectedEntityId;
          return (
            <button
              key={pin.id}
              onClick={() => onSelectLocation(pin.entity.id, pin.entity.name)}
              className={cn(
                'flex w-full items-center gap-2.5 border-b border-[color:color-mix(in_oklab,var(--wm-border)_56%,transparent)] py-1 text-left transition-opacity hover:opacity-80 last:border-0',
                isSelected && 'opacity-100',
              )}
            >
              <SectionIcon icon={<MapPin className="h-3 w-3" />} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: 'var(--wm-text)' }}>{pin.entity.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>Location</p>
              </div>
              {isSelected && (
                <span className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]" style={{ borderColor: 'var(--wm-accent-border)', background: 'var(--wm-accent-trace)', color: 'var(--wm-accent)' }}>
                  Selected
                </span>
              )}
            </button>
          );
        })}
        {displayed.length === 0 && (
          <p className="py-2 text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No locations pinned</p>
        )}
      </div>
    </CardShell>
  );
}

function hpValue(hitPoints: unknown) {
  if (!hitPoints || typeof hitPoints !== 'object') return null;
  const hp = hitPoints as { current?: number; max?: number };
  if (typeof hp.current !== 'number' || typeof hp.max !== 'number' || hp.max <= 0) return null;
  return {
    current: Math.max(0, hp.current),
    max: Math.max(1, hp.max),
  };
}

function PartyCard({ campaignId, slug }: { campaignId: string; slug: string }) {
  const { data: members } = trpc.characters.getCampaignCharacters.useQuery({ campaignId });

  const displayed = useMemo(() => [...(members ?? [])].slice(0, 4), [members]);

  return (
    <CardShell className="bottom-5 left-1/2 z-10 w-64 -translate-x-1/2 max-[900px]:hidden">
      <SectionHeader title="Party" href={`/campaigns/${slug}/characters`} icon={<Users className="h-3 w-3" />} />
      <div className="space-y-1.5">
        {displayed.map((member) => {
          const character = member.character;
          const user = character.user;
          const hp = hpValue(character.hitPoints);
          const fill = hp ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;
          return (
            <div key={member.id} className="flex items-center gap-2.5 border-b border-[color:color-mix(in_oklab,var(--wm-border)_56%,transparent)] py-1 last:border-0">
              <AvatarInitial name={user.displayName ?? user.name ?? character.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: 'var(--wm-text)' }}>
                  {user.displayName ?? user.name ?? character.name}
                </p>
                <p className="truncate text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
                  {character.class ?? 'Adventurer'}
                  {character.level ? ` · Level ${character.level}` : ''}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in oklab, var(--wm-border) 45%, transparent)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${fill}%`,
                      background: 'linear-gradient(90deg, var(--wm-accent), color-mix(in oklab, var(--wm-accent) 72%, white))',
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px]" style={{ color: 'var(--wm-soft-text)' }}>
                  {hp ? `${hp.current}/${hp.max}` : '—'}
                </p>
              </div>
            </div>
          );
        })}
        {displayed.length === 0 && (
          <p className="py-2 text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No party members</p>
        )}
      </div>
    </CardShell>
  );
}

function ActivityCard({
  campaignId,
  selectedEntityId,
  selectedEntityName,
}: {
  campaignId: string;
  selectedEntityId: string | null;
  selectedEntityName: string;
}) {
  const { data: activeSession } = trpc.sessions.getActive.useQuery({ campaignId });
  const { data: sessions } = trpc.sessions.getAll.useQuery({ campaignId });
  const { data: activity } = trpc.world.getRecentActivity.useQuery(
    { campaignId, limit: 4 },
    { enabled: !!activeSession },
  );
  const updatePrep = trpc.sessions.updatePrep.useMutation();

  const nextPlanningSession = useMemo(
    () => [...(sessions ?? [])].find((session) => session.status === 'planning'),
    [sessions],
  );

  const prepData = useMemo(() => {
    if (!nextPlanningSession?.prepData) return null;
    return nextPlanningSession.prepData as SessionPrepData;
  }, [nextPlanningSession]);

  const reminders = useMemo(() => {
    if (!prepData) return [];
    return [...(prepData.reminders ?? [])].slice(0, 5);
  }, [prepData]);

  const activityItems = useMemo(() => {
    const items = activity ?? [];
    if (!selectedEntityId && !selectedEntityName.trim()) return items;

    const scope = selectedEntityName.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = [item.name, item.type, item.href].join(' ').toLowerCase();
      return item.id === selectedEntityId || (scope ? haystack.includes(scope) : false);
    });
  }, [activity, selectedEntityId, selectedEntityName]);

  const toggleReminder = async (reminderId: string) => {
    if (!nextPlanningSession || !prepData) return;
    const updatedReminders = (prepData.reminders ?? []).map((reminder) =>
      reminder.id === reminderId ? { ...reminder, completed: !reminder.completed } : reminder,
    );

    await updatePrep.mutateAsync({
      id: nextPlanningSession.id,
      prepData: {
        reminders: updatedReminders,
      },
    });
  };

  return (
    <CardShell className="bottom-5 right-5 z-10 w-52 max-[900px]:hidden">
      <SectionHeader
        title={activeSession ? 'Recent Activity' : "Today's Plan"}
        icon={activeSession ? <Activity className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
      />
      {activeSession ? (
        <div className="space-y-1.5">
          {activityItems.map((item) => (
            <div key={`${item.source}:${item.id}`} className="flex items-start gap-2 border-b border-[color:color-mix(in_oklab,var(--wm-border)_56%,transparent)] py-1 last:border-0">
              <SectionIcon icon={<Activity className="h-3 w-3" />} tone="var(--wm-soft-text)" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[11px] leading-snug" style={{ color: 'var(--wm-soft-text)' }}>
                  <span className="font-medium" style={{ color: 'var(--wm-text)' }}>{item.name}</span>{' '}
                  {item.status.toLowerCase()}
                </p>
                <p className="mt-0.5 text-[9px]" style={{ color: 'var(--wm-muted)' }}>
                  {new Date(item.changedAt).toLocaleDateString('en-AU')}
                </p>
              </div>
            </div>
          ))}
          {activityItems.length === 0 && (
            <p className="py-2 text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No recent activity</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {reminders.map((reminder) => (
            <button
              key={reminder.id}
              onClick={() => void toggleReminder(reminder.id)}
              className="flex w-full items-start gap-2 py-0.5 text-left transition-opacity hover:opacity-80"
            >
              <CheckSquare
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 flex-shrink-0',
                  reminder.completed ? '' : '',
                )}
                style={{ color: reminder.completed ? 'var(--wm-accent)' : 'var(--wm-muted)' }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'line-clamp-1 text-[11px]',
                    reminder.completed && 'line-through',
                  )}
                  style={{ color: reminder.completed ? 'var(--wm-muted)' : 'var(--wm-soft-text)' }}
                >
                  {reminder.title}
                </p>
                {reminder.description && (
                  <p className="line-clamp-1 text-[9px]" style={{ color: 'var(--wm-muted)' }}>{reminder.description}</p>
                )}
              </div>
            </button>
          ))}
          {reminders.length === 0 && (
            <div className="space-y-2 py-1">
              <p className="text-center text-[10px]" style={{ color: 'var(--wm-muted)' }}>No prep reminders yet</p>
              <p className="text-center text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--wm-accent)' }}>
                {nextPlanningSession ? 'Open prep to add reminders' : 'No planning session yet'}
              </p>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}

export function WorldMapOverlay(props: WorldMapOverlayProps) {
  const { campaignId, slug, selectedEntityId, selectedEntityName, locationPins, onSelectLocation } = props;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <SessionCard campaignId={campaignId} slug={slug} />
      <NpcCard campaignId={campaignId} slug={slug} selectedEntityName={selectedEntityName} />
      <QuestCard campaignId={campaignId} selectedEntityName={selectedEntityName} />
      <LocationsCard
        locationPins={locationPins}
        slug={slug}
        selectedEntityId={selectedEntityId}
        onSelectLocation={onSelectLocation}
      />
      <PartyCard campaignId={campaignId} slug={slug} />
      <ActivityCard
        campaignId={campaignId}
        selectedEntityId={selectedEntityId}
        selectedEntityName={selectedEntityName}
      />
    </div>
  );
}
