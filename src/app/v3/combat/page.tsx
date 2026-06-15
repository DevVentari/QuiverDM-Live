'use client';

import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import { useHeartflame } from '@/components/shell/v3/heartflame-context';
import { primaryNudge, type SurfacedNudge } from '@/lib/heartflame';
import type { BoardParticipant } from '@/server/services/heartflame.service';

const ECONOMY: Array<{ field: 'actionUsed' | 'bonusActionUsed' | 'reactionUsed'; icon: string; label: string }> = [
  { field: 'actionUsed', icon: 'combat/action', label: 'Action' },
  { field: 'bonusActionUsed', icon: 'combat/bonus-action', label: 'Bonus' },
  { field: 'reactionUsed', icon: 'combat/reaction', label: 'Reaction' },
];

function asConditions(c: unknown): string[] {
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [];
}

export default function CombatPage() {
  const { setNudge } = useHeartflame();
  const utils = trpc.useUtils();
  const board = trpc.heartflame.demoBoard.useQuery(undefined, { staleTime: 0 });

  const setState = trpc.heartflame.setParticipantState.useMutation({
    onSuccess: (res) => {
      utils.heartflame.demoBoard.invalidate();
      setNudge(primaryNudge(res.nudges) as SurfacedNudge | null);
    },
  });

  const patch = (p: BoardParticipant, data: Record<string, unknown>) =>
    setState.mutate({ participantId: p.id, patch: data });

  if (board.isLoading) {
    return <div className="px-8 py-16 text-[var(--qd-ink-muted)]">Gathering the combatants…</div>;
  }
  if (!board.data) {
    return <div className="px-8 py-16 text-[var(--qd-ink-muted)]">No encounter. The chronicle is quiet.</div>;
  }

  const { name, round, participants } = board.data;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--qd-ink-faint)]">
        Combat · Round {round}
      </span>
      <h1 className="mt-1 font-[family-name:var(--qd-font-display)] text-[34px] leading-tight text-[var(--qd-ink-strong)]">
        {name}
      </h1>
      <p className="mt-2 text-[var(--qd-text-body-sm)] text-[var(--qd-ink-muted)]">
        Toggle action economy or take damage — the Heartflame watches from the margin (bottom-right).
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {participants.map((p) => {
          const bloodied = p.maxHp > 0 && p.hp <= Math.floor(p.maxHp / 2);
          const conditions = asConditions(p.conditions);
          return (
            <div
              key={p.id}
              className="rounded-[14px] border border-[var(--qd-border-faint)] p-4"
              style={{ background: 'var(--qd-grad-card), var(--qd-card)' }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--qd-border-accent)] font-[family-name:var(--qd-font-mono)] text-xs text-[var(--qd-accent-text)]">
                  {p.initiative}
                </span>
                <span className="flex-1 font-[family-name:var(--qd-font-display)] text-[20px] text-[var(--qd-ink)]">
                  {p.name}
                </span>
                <span
                  className="font-[family-name:var(--qd-font-mono)] text-sm"
                  style={{ color: bloodied ? 'var(--qd-danger-bright)' : 'var(--qd-success)' }}
                >
                  {p.hp}/{p.maxHp}
                  {bloodied && <span className="ml-2 text-[10px] uppercase tracking-wide">bloodied</span>}
                </span>
              </div>

              {/* HP bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`,
                    background: bloodied ? 'var(--qd-grad-danger)' : 'var(--qd-grad-success)',
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* Action economy pips */}
                {ECONOMY.map(({ field, icon, label }) => {
                  const available = !p[field];
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => patch(p, { [field]: !p[field] })}
                      title={`${label} ${available ? 'available' : 'used'}`}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] transition-colors"
                      style={{
                        borderColor: available ? 'var(--qd-border-accent)' : 'var(--qd-border-faint)',
                        color: available ? 'var(--qd-accent-text)' : 'var(--qd-ink-faint)',
                        opacity: available ? 1 : 0.5,
                      }}
                    >
                      <MaskedDndIcon name={icon} size={13} />
                      {label}
                    </button>
                  );
                })}

                {/* Concentration */}
                <button
                  type="button"
                  onClick={() => patch(p, { concentration: !p.concentration })}
                  title="Toggle concentration"
                  className="inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] transition-colors"
                  style={{
                    borderColor: p.concentration ? 'var(--qd-arcane)' : 'var(--qd-border-faint)',
                    color: p.concentration ? 'var(--qd-arcane-bright)' : 'var(--qd-ink-faint)',
                  }}
                >
                  <MaskedDndIcon name="spell/concentration" size={13} />
                  Concentration
                </button>

                <span className="flex-1" />

                {/* Quick HP */}
                <button
                  type="button"
                  onClick={() => patch(p, { hp: Math.max(0, p.hp - 5) })}
                  className="rounded-[10px] border border-[var(--qd-border-faint)] px-2.5 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-danger-bright)] transition-colors hover:border-[var(--qd-border-accent)]"
                >
                  −5 HP
                </button>
                <button
                  type="button"
                  onClick={() => patch(p, { hp: Math.min(p.maxHp, p.hp + 5) })}
                  className="rounded-[10px] border border-[var(--qd-border-faint)] px-2.5 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-success)] transition-colors hover:border-[var(--qd-border-accent)]"
                >
                  +5 HP
                </button>
              </div>

              {conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conditions.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-[var(--qd-border-faint)] px-2 py-0.5 font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-wide text-[var(--qd-ink-muted)]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
