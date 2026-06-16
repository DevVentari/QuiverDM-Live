'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

/**
 * Player Combat HUD — /v3/play/[slug]/combat
 *
 * Player-facing live combat surface. NO CampaignProvider: slug comes from
 * useParams(). The player's HP/temp-HP/conditions are read from and written to
 * `play.getSessionState` / `play.updateSessionState`. Big touch targets — this
 * is held one-handed at the table on a phone.
 */

// Shape returned by play.getSessionState (Prisma PlayerSessionState | null).
interface SessionState {
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: unknown;
  spellSlots: unknown;
  hitDice: unknown;
}

// The 5e conditions a player toggles on themselves at the table.
const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
  'Stunned', 'Unconscious', 'Exhaustion',
] as const;

function asConditions(c: unknown): string[] {
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [];
}

// Defensive read: a session is "active" if it's running or, failing that, the
// most recent one we know about.
function pickActiveSessionId(hub: unknown): string | null {
  const sessions = (hub as { sessions?: Array<{ id: string; status?: string | null }> } | undefined)?.sessions;
  const next = (hub as { nextSession?: { id: string; status?: string | null } | null } | undefined)?.nextSession;
  if (next?.status === 'in_progress') return next.id;
  const live = sessions?.find((s) => s.status === 'in_progress');
  if (live) return live.id;
  if (next?.id) return next.id;
  return sessions?.[0]?.id ?? null;
}

function hpColor(ratio: number): string {
  if (ratio <= 0.25) return 'var(--qd-danger-bright)';
  if (ratio <= 0.5) return 'var(--qd-warn)';
  return 'var(--qd-success)';
}

export default function PlayerCombatPage() {
  const { slug } = useParams() as { slug: string };
  const utils = trpc.useUtils();

  const hub = trpc.play.getCampaignHub.useQuery({ slug }, { staleTime: 30_000 });
  const sessionId = useMemo(() => pickActiveSessionId(hub.data), [hub.data]);

  const stateQuery = trpc.play.getSessionState.useQuery(
    { sessionId: sessionId ?? '' },
    { enabled: !!sessionId, staleTime: 5_000 },
  );

  const update = trpc.play.updateSessionState.useMutation({
    onSuccess: () => {
      if (sessionId) utils.play.getSessionState.invalidate({ sessionId });
    },
  });

  const state = stateQuery.data as SessionState | null | undefined;
  const character = (hub.data as { character?: { name?: string; class?: string | null; level?: number } | null } | undefined)?.character ?? null;

  // ---- loading / error / empty gates ----
  if (hub.isLoading || (sessionId && stateQuery.isLoading)) {
    return <div className="px-6 py-16 text-center text-qd-ink-muted">Readying for the fray…</div>;
  }
  if (hub.error) {
    return <div className="px-6 py-16 text-center text-qd-ink-muted">The link to the table broke. Try again.</div>;
  }
  if (!sessionId || (!state && !stateQuery.isLoading)) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="font-qd-display text-2xl text-qd-ink-strong">The field is still</div>
        <p className="mt-2 text-qd-body-sm text-qd-ink-muted">No active session — combat is quiet.</p>
      </div>
    );
  }
  if (!state) {
    return <div className="px-6 py-16 text-center text-qd-ink-muted">Readying for the fray…</div>;
  }

  // ---- derived ----
  const hp = state.hp;
  const maxHp = Math.max(1, state.maxHp);
  const tempHp = state.tempHp ?? 0;
  const conditions = asConditions(state.conditions);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const barColor = hpColor(ratio);
  const pending = update.isPending;

  // Every write must carry the current hp + maxHp (router requires them).
  const write = (patch: { hp?: number; tempHp?: number; conditions?: string[] }) => {
    if (!sessionId) return;
    update.mutate({
      sessionId,
      hp: patch.hp ?? hp,
      maxHp,
      tempHp: patch.tempHp ?? tempHp,
      conditions: patch.conditions ?? conditions,
    });
  };

  const bumpHp = (delta: number) => write({ hp: Math.max(0, Math.min(maxHp, hp + delta)) });
  const bumpTemp = (delta: number) => write({ tempHp: Math.max(0, tempHp + delta) });
  const toggleCondition = (c: string) =>
    write({ conditions: conditions.includes(c) ? conditions.filter((x) => x !== c) : [...conditions, c] });

  const subtitle = [character?.class?.toUpperCase(), character?.level ? `LV ${character.level}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
      {/* IDENTITY STRIP */}
      <header className="flex items-center gap-3">
        <div
          className="grid h-[54px] w-[54px] flex-none place-items-center rounded-qd-lg border border-qd-accent font-qd-display text-xl text-qd-accent-text"
          style={{ background: 'rgba(255,255,255,.03)' }}
        >
          {(character?.name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-qd-display text-[20px] leading-tight text-qd-ink-strong">
            {character?.name ?? 'Your hero'}
          </div>
          <div className="font-qd-mono text-[10px] uppercase tracking-[0.08em] text-qd-ink-muted">
            {subtitle || 'Adventurer'}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-qd-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ background: 'rgba(217,138,61,.16)', border: '1px solid var(--qd-border-accent)', color: 'var(--qd-accent-text)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--qd-accent-text)', boxShadow: '0 0 8px var(--qd-accent-text)' }} />
          Live
        </span>
      </header>

      {/* HP STRIP */}
      <section
        className="rounded-qd-lg border border-qd-faint p-4"
        style={{ background: 'rgba(255,235,205,.022)' }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-ink-muted">Hit Points</span>
          {tempHp > 0 && (
            <span className="font-qd-mono text-[10px] text-qd-ink-muted" style={{ color: 'var(--qd-arcane-bright)' }}>
              +{tempHp} temp
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-end gap-2">
          <span className="font-qd-display text-[34px] leading-none" style={{ color: barColor }}>{hp}</span>
          <span className="font-qd-display text-[16px] leading-snug text-qd-ink-muted">/ {maxHp}</span>
          {tempHp > 0 && (
            <span className="ml-1 font-qd-display text-[18px] leading-snug" style={{ color: 'var(--qd-arcane-bright)' }}>
              (+{tempHp})
            </span>
          )}
        </div>

        {/* HP bar */}
        <div
          className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full border"
          style={{ background: 'rgba(0,0,0,.4)', borderColor: 'var(--qd-border-faint)' }}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, background: barColor }} />
        </div>

        {/* −/+ HP controls — big touch targets */}
        <div className="mt-3.5 grid grid-cols-4 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => bumpHp(-5)}
            className="h-12 rounded-qd-md border border-qd-strong font-qd-display text-[15px] font-bold disabled:opacity-50"
            style={{ background: 'rgba(168,64,47,.14)', color: 'var(--qd-danger-bright)' }}
          >
            −5
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => bumpHp(-1)}
            className="h-12 rounded-qd-md border border-qd-strong font-qd-display text-[15px] font-bold disabled:opacity-50"
            style={{ background: 'rgba(168,64,47,.10)', color: 'var(--qd-danger-bright)' }}
          >
            −1
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => bumpHp(1)}
            className="h-12 rounded-qd-md border border-qd-strong font-qd-display text-[15px] font-bold disabled:opacity-50"
            style={{ background: 'rgba(127,174,90,.10)', color: 'var(--qd-success)' }}
          >
            +1
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => bumpHp(5)}
            className="h-12 rounded-qd-md border border-qd-strong font-qd-display text-[15px] font-bold disabled:opacity-50"
            style={{ background: 'rgba(127,174,90,.14)', color: 'var(--qd-success)' }}
          >
            +5
          </button>
        </div>

        {/* Temp HP controls */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="font-qd-mono text-[10px] uppercase tracking-[0.1em] text-qd-ink-muted">Temp HP</span>
          <span className="flex-1" />
          <button
            type="button"
            disabled={pending || tempHp <= 0}
            onClick={() => bumpTemp(-1)}
            className="grid h-11 w-11 place-items-center rounded-qd-md border border-qd-strong font-qd-display text-[16px] disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,.03)', color: 'var(--qd-arcane-bright)' }}
          >
            −
          </button>
          <span className="grid h-11 min-w-[44px] place-items-center font-qd-display text-[18px]" style={{ color: 'var(--qd-arcane-bright)' }}>
            {tempHp}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => bumpTemp(1)}
            className="grid h-11 w-11 place-items-center rounded-qd-md border border-qd-strong font-qd-display text-[16px] disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,.03)', color: 'var(--qd-arcane-bright)' }}
          >
            +
          </button>
        </div>
      </section>

      {/* CONDITIONS */}
      <section>
        <div className="mb-2.5 font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-ink-muted">Conditions</div>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const on = conditions.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={pending}
                onClick={() => toggleCondition(c)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-qd-md border px-3.5 py-2 text-[13px] transition-colors disabled:opacity-50"
                style={
                  on
                    ? { background: 'rgba(156,80,72,.16)', borderColor: 'var(--qd-danger)', color: 'var(--qd-danger-bright)' }
                    : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)', color: 'var(--qd-ink-muted)' }
                }
              >
                {on && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--qd-danger-bright)' }} />}
                {c}
              </button>
            );
          })}
        </div>
        {conditions.length === 0 && (
          <p className="mt-2 font-qd-mono text-[10px] text-qd-ink-faint">No afflictions — tap one if the battle turns.</p>
        )}
      </section>

      {update.error && (
        <p className="text-center text-[12px]" style={{ color: 'var(--qd-danger-bright)' }}>
          Couldn’t save — tap again.
        </p>
      )}
    </div>
  );
}
