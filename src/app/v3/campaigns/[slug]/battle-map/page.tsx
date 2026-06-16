'use client';

/**
 * v3 Battle Map — rebuilt from docs/assets/designs/v3/designs/Combat Map HiFi.dc.html
 * on the --qd-* token system. Three columns: initiative rail · tactical map canvas
 * (image-slot placeholder + grid overlay + positioned tokens + fog) · selected-token
 * inspector (HP, conditions, action economy).
 *
 * Wired to live data — the SAME source the v3 combat tracker uses:
 *  - trpc.heartflame.demoBoard → EncounterBoard { name, round, participants[] }
 *  - trpc.heartflame.setParticipantState → write HP / action economy, re-evaluate.
 *
 * There is NO token position data on participants, so tokens lay out on a
 * deterministic fallback grid.  // TODO: real token x/y positions  // TODO: fog of war.
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import type { BoardParticipant } from '@/server/services/heartflame.service';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

type TokenType = 'pc' | 'npc' | 'monster';

// Token ring / fill palette by participant type. Defensive default → npc.
const TYPE_STYLE: Record<TokenType, { ring: string; text: string; fillFrom: string; barFrom: string; barTo: string }> = {
  pc: {
    ring: 'var(--qd-success)',
    text: 'var(--qd-success-hi)',
    fillFrom: 'rgba(127,174,90,.28)',
    barFrom: '#5f8f45',
    barTo: '#8fc466',
  },
  npc: {
    ring: 'var(--qd-accent)',
    text: 'var(--qd-accent-text)',
    fillFrom: 'rgba(217,138,61,.30)',
    barFrom: '#b8453a',
    barTo: '#e0944a',
  },
  monster: {
    ring: 'var(--qd-danger)',
    text: 'var(--qd-danger-hi)',
    fillFrom: 'rgba(196,69,58,.30)',
    barFrom: '#8a2f26',
    barTo: '#c4453a',
  },
};

const typeOf = (t: unknown): TokenType => {
  const s = typeof t === 'string' ? t.toLowerCase() : '';
  return s === 'pc' || s === 'monster' ? s : s === 'npc' ? 'npc' : 'npc';
};

const typeLabel = (t: TokenType): string => (t === 'pc' ? 'PLAYER' : t === 'monster' ? 'MONSTER' : 'NPC');

const ECONOMY: Array<{ field: 'actionUsed' | 'bonusActionUsed' | 'reactionUsed'; icon: string; label: string }> = [
  { field: 'actionUsed', icon: 'combat/action', label: 'Action' },
  { field: 'bonusActionUsed', icon: 'combat/bonus-action', label: 'Bonus' },
  { field: 'reactionUsed', icon: 'combat/reaction', label: 'Reaction' },
];

function asConditions(c: unknown): string[] {
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const hpPct = (p: BoardParticipant): number =>
  p.maxHp > 0 ? Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100)) : 0;

const isBloodied = (p: BoardParticipant): boolean => p.maxHp > 0 && p.hp <= Math.floor(p.maxHp / 2);

// Deterministic fallback layout so tokens scatter across the canvas while there is
// no real position data. // TODO: real token x/y positions (drag tokens → token.x/y).
function fallbackXY(index: number, count: number): { x: number; y: number } {
  const cols = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
  const col = index % cols;
  const rowN = Math.floor(index / cols);
  return {
    x: 22 + col * Math.min(24, 56 / cols) + (rowN % 2) * 6,
    y: 30 + rowN * 20,
  };
}

// Roman numeral for the round counter (matches the design's "ROUND III").
function roman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rem = Math.floor(n);
  let out = '';
  for (const [v, sym] of map) {
    while (rem >= v) {
      out += sym;
      rem -= v;
    }
  }
  return out;
}

export default function BattleMapPage() {
  const { slug, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const board = trpc.heartflame.demoBoard.useQuery(undefined, { staleTime: 0 });

  const setState = trpc.heartflame.setParticipantState.useMutation({
    onSuccess: () => {
      utils.heartflame.demoBoard.invalidate();
    },
  });

  const patch = (p: BoardParticipant, data: Record<string, unknown>) =>
    setState.mutate({ participantId: p.id, patch: data });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const participants = board.data?.participants ?? [];
  const selected = participants.find((p) => p.id === selectedId) ?? participants[0] ?? null;

  // The combatant whose turn it is — highest initiative (design highlights "current turn").
  const currentTurnId = participants[0]?.id ?? null;

  const positions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    participants.forEach((p, i) => m.set(p.id, fallbackXY(i, participants.length)));
    return m;
  }, [participants]);

  // ── States ──────────────────────────────────────────────────────────────
  if (board.isLoading) {
    return (
      <div className={`${mono} flex h-full items-center justify-center px-8 py-16 text-[var(--qd-ink-muted)]`}>
        Gathering the combatants…
      </div>
    );
  }
  if (board.error) {
    return (
      <div className={`${mono} flex h-full items-center justify-center px-8 py-16 text-[var(--qd-ink-muted)]`}>
        The map would not draw. Try again.
      </div>
    );
  }
  if (!board.data || participants.length === 0) {
    return (
      <div className={`${mono} flex h-full items-center justify-center px-8 py-16 text-[var(--qd-ink-muted)]`}>
        No combatants on the field.
      </div>
    );
  }

  const { name, round } = board.data;
  const hostileCount = participants.filter((p) => typeOf(p.type) === 'monster').length;
  const selType = selected ? typeOf(selected.type) : 'npc';
  const selStyle = TYPE_STYLE[selType];
  const selConditions = selected ? asConditions(selected.conditions) : [];

  return (
    <div className="flex h-full flex-col">
      {/* ===== HEADER ===== */}
      <div className="flex items-center gap-3.5 border-b border-[var(--qd-border-faint)] px-5 py-3" style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.05),transparent)' }}>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px]" style={{ background: 'linear-gradient(150deg,var(--qd-accent-bright),var(--qd-accent))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)' }}>
          <MaskedDndIcon name="combat/target" size={14} style={{ color: 'var(--qd-bg)' }} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[18px] leading-none text-[var(--qd-ink-strong)]">{name}</div>
          <div className={`${mono} mt-1 text-[9px] tracking-[0.08em] text-[var(--qd-ink-muted)]`}>{slug} · BATTLE MAP</div>
        </div>
        <span className="flex-1" />
        <div className={`${mono} hidden gap-1.5 text-[8.5px] sm:flex`}>
          {['Grid ✓', 'Fog ✓', 'Tokens', 'Ruler'].map((c, i) => (
            <span
              key={c}
              className="rounded-[7px] border px-2.5 py-1.5"
              style={
                i < 2
                  ? { background: 'rgba(217,138,61,.12)', borderColor: 'var(--qd-border-accent)', color: 'var(--qd-accent-text)' }
                  : { background: 'rgba(0,0,0,.3)', borderColor: 'var(--qd-border-strong)', color: 'var(--qd-ink-2)' }
              }
            >
              {c}
            </span>
          ))}
        </div>
        <div className="text-center">
          <div className={`${mono} text-[8px] tracking-[0.2em] text-[var(--qd-ink-muted)]`}>ROUND</div>
          <div className={`${display} text-[24px] font-bold leading-[.85] text-[var(--qd-ink-strong)]`}>{roman(round)}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== INITIATIVE RAIL ===== */}
        <aside className="flex w-[212px] flex-none flex-col gap-2 overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>INITIATIVE</div>
          {participants.map((p) => {
            const t = typeOf(p.type);
            const ts = TYPE_STYLE[t];
            const active = selected?.id === p.id;
            const turn = currentTurnId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="flex min-h-[52px] items-center gap-2.5 rounded-[11px] border p-2 text-left transition-colors"
                style={
                  active
                    ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.08))', borderColor: 'var(--qd-border-accent)' }
                    : turn
                      ? { background: 'linear-gradient(180deg,rgba(217,138,61,.1),rgba(0,0,0,.15))', borderColor: 'var(--qd-border-accent)' }
                      : { background: 'linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.15))', borderColor: 'var(--qd-border-faint)' }
                }
              >
                <span
                  className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full border-2 text-[14px] font-bold"
                  style={{ borderColor: ts.ring, background: `radial-gradient(circle, ${ts.fillFrom}, rgba(0,0,0,.3))`, color: ts.text }}
                >
                  {initials(p.name).charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-[13px] text-[var(--qd-ink)]">{p.name}</span>
                    <span className={`${mono} flex-none text-[10px] text-[var(--qd-ink-muted)]`}>{p.initiative}</span>
                  </span>
                  <span className="mt-1 block h-[5px] overflow-hidden rounded-[3px] bg-[rgba(0,0,0,0.5)]">
                    <span className="block h-full rounded-[3px]" style={{ width: `${hpPct(p)}%`, background: `linear-gradient(90deg, ${ts.barFrom}, ${ts.barTo})` }} />
                  </span>
                </span>
              </button>
            );
          })}
          <span className="flex-1" />
          <div className={`${mono} px-0.5 text-[8px] leading-relaxed text-[var(--qd-ink-faintest)]`}>
            {participants.length} combatants · {hostileCount} hostile
            <br />
            {/* TODO: drag tokens on the map → real token x/y positions */}
            drag tokens on the map →
          </div>
        </aside>

        {/* ===== BATTLE MAP CANVAS ===== */}
        <div className="relative flex-1 overflow-hidden bg-[#100c0a]">
          {/* map art placeholder (user-fillable image slot) */}
          <div className="absolute inset-0 grid place-items-center">
            <span className={`${mono} text-[10px] tracking-wide text-[var(--qd-ink-faintest)]`}>
              drop battle-map art — grid · tokens · fog overlay on top
            </span>
          </div>
          {/* grid overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(0deg,rgba(255,235,205,.045) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(255,235,205,.045) 0 1px,transparent 1px 40px)',
            }}
          />

          {/* ===== TOKENS ===== */}
          {participants.map((p) => {
            const t = typeOf(p.type);
            const ts = TYPE_STYLE[t];
            const pos = positions.get(p.id) ?? { x: 50, y: 50 };
            const turn = currentTurnId === p.id;
            const isSelected = selected?.id === p.id;
            const dead = !p.isAlive || p.hp <= 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: turn ? 3 : isSelected ? 2 : 1, opacity: dead ? 0.45 : 1 }}
              >
                <span className="relative mx-auto flex h-[52px] w-[52px] items-center justify-center">
                  {turn && (
                    <span
                      className="absolute rounded-full border-2 border-dashed"
                      style={{ inset: -6, borderColor: 'rgba(217,138,61,.85)' }}
                    />
                  )}
                  <span
                    className="grid h-[46px] w-[46px] place-items-center rounded-full border-2 text-[18px] font-bold"
                    style={{
                      borderColor: isSelected ? 'var(--qd-accent-hi)' : ts.ring,
                      background: `radial-gradient(circle, ${ts.fillFrom}, rgba(0,0,0,.35))`,
                      color: ts.text,
                      boxShadow: turn ? '0 0 22px rgba(217,138,61,.55)' : '0 4px 14px rgba(0,0,0,.5)',
                    }}
                  >
                    {initials(p.name)}
                  </span>
                </span>
                {/* token HP bar */}
                <span className="mx-auto mt-1.5 block h-[4px] w-[40px] overflow-hidden rounded-[3px] bg-[rgba(0,0,0,0.55)]">
                  <span className="block h-full" style={{ width: `${hpPct(p)}%`, background: `linear-gradient(90deg, ${ts.barFrom}, ${ts.barTo})` }} />
                </span>
                <span className={`${mono} mt-1 block whitespace-nowrap text-[8px]`} style={{ color: ts.text, textShadow: '0 1px 4px #000' }}>
                  {turn ? '▸ ' : ''}
                  {p.name}
                </span>
              </button>
            );
          })}

          {/* fog of war — // TODO: fog of war (real reveal state per region) */}
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[30%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(8,6,5,.94) 46%)' }} />
          <div className={`${mono} absolute right-4 top-3.5 z-[4] text-[8px] tracking-[0.1em] text-[var(--qd-ink-faintest)]`}>▒ FOG OF WAR</div>

          {/* zoom controls (visual — // TODO: real zoom/pan) */}
          <div className="absolute left-3.5 top-3.5 z-[5] flex flex-col gap-1.5">
            {['+', '−', '⤢'].map((c) => (
              <span key={c} className="grid h-9 w-9 cursor-pointer place-items-center rounded-[8px] border border-[var(--qd-border-strong)] text-[16px] text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>
                {c}
              </span>
            ))}
          </div>
          {/* DM fog tools */}
          {isDM && (
            <div className={`${mono} absolute right-3.5 top-3.5 z-[5] flex gap-1.5 text-[8.5px]`}>
              <span className="cursor-pointer rounded-[7px] border px-2.5 py-2 text-[var(--qd-accent-text)]" style={{ background: 'rgba(0,0,0,.5)', borderColor: 'var(--qd-border-accent)' }}>✦ Reveal fog</span>
              <span className="cursor-pointer rounded-[7px] border border-[var(--qd-border-strong)] px-2.5 py-2 text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>Brush</span>
            </div>
          )}
          {/* scale legend */}
          <div className="absolute bottom-3 left-3.5 z-[5] flex items-center gap-2.5">
            <span className="inline-block h-2 w-[26px] rounded-[2px] border border-[rgba(255,235,205,.4)]" />
            <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>1 square = 5 ft</span>
            <span className={`${mono} text-[8px] text-[var(--qd-ink-faintest)]`}>drag tokens · paint fog · scroll to zoom</span>
          </div>
        </div>

        {/* ===== TOKEN INSPECTOR ===== */}
        <aside className="flex w-[300px] flex-none flex-col gap-3.5 overflow-auto border-l border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.16)] p-4">
          <div className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-accent-text)]`}>▸ SELECTED TOKEN</div>

          {!selected ? (
            <p className={`${mono} text-[10px] text-[var(--qd-ink-muted)]`}>Select a token on the field.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-16 w-16 flex-none place-items-center rounded-full border-2 text-[22px] font-bold"
                  style={{ borderColor: selStyle.ring, background: `radial-gradient(circle, ${selStyle.fillFrom}, rgba(0,0,0,.35))`, color: selStyle.text }}
                >
                  {initials(selected.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[20px] leading-none text-[var(--qd-ink-strong)]">{selected.name}</div>
                  <div className={`${mono} mt-1.5 text-[8px] tracking-[0.06em]`} style={{ color: selStyle.text }}>
                    {typeLabel(selType)}
                    {isBloodied(selected) ? ' · BLOODIED' : ''}
                    {selected.concentration ? ' · CONCENTRATING' : ''}
                  </div>
                </div>
              </div>

              {/* HP */}
              <div className="flex items-end gap-1.5">
                <span
                  className={`${display} text-[30px] font-bold leading-[.85] text-[var(--qd-ink-strong)]`}
                  style={{ borderBottom: '2px dashed rgba(217,138,61,.5)' }}
                >
                  {selected.hp}
                </span>
                <span className="text-[14px] text-[var(--qd-ink-muted)]">
                  / {selected.maxHp} HP{selected.tempHp > 0 ? ` (+${selected.tempHp} temp)` : ''}
                </span>
              </div>
              <div className="h-[9px] overflow-hidden rounded-[5px] bg-[rgba(0,0,0,0.5)]">
                <div className="h-full rounded-[5px]" style={{ width: `${hpPct(selected)}%`, background: `linear-gradient(90deg, ${selStyle.barFrom}, ${selStyle.barTo})` }} />
              </div>

              {/* HP quick-adjust — big touch targets for mid-combat */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => patch(selected, { hp: Math.max(0, selected.hp - 5) })}
                  className={`${display} rounded-[10px] border-none p-3 text-[13px] font-bold text-[#fce9da]`}
                  style={{ background: 'linear-gradient(180deg,#cf5f2a,#a8401f)' }}
                >
                  ⚔ −5 Damage
                </button>
                <button
                  type="button"
                  onClick={() => patch(selected, { hp: Math.min(selected.maxHp, selected.hp + 5) })}
                  className={`${display} rounded-[10px] border p-3 text-[13px] font-bold`}
                  style={{ background: 'rgba(95,143,69,.16)', borderColor: 'rgba(95,143,69,.5)', color: 'var(--qd-success-hi)' }}
                >
                  ✚ +5 Heal
                </button>
              </div>

              {/* Action economy */}
              <div>
                <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>ACTION ECONOMY</div>
                <div className="grid grid-cols-3 gap-2">
                  {ECONOMY.map(({ field, icon, label }) => {
                    const available = !selected[field];
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => patch(selected, { [field]: !selected[field] })}
                        title={`${label} ${available ? 'available' : 'used'}`}
                        className={`${mono} flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[10px] border px-1 py-2 text-[10px] transition-colors`}
                        style={{
                          borderColor: available ? 'var(--qd-border-accent)' : 'var(--qd-border-faint)',
                          color: available ? 'var(--qd-accent-text)' : 'var(--qd-ink-faint)',
                          opacity: available ? 1 : 0.5,
                        }}
                      >
                        <MaskedDndIcon name={icon} size={15} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => patch(selected, { concentration: !selected.concentration })}
                  title="Toggle concentration"
                  className={`${mono} mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border text-[11px] transition-colors`}
                  style={{
                    borderColor: selected.concentration ? 'var(--qd-arcane)' : 'var(--qd-border-faint)',
                    color: selected.concentration ? 'var(--qd-arcane-bright)' : 'var(--qd-ink-faint)',
                  }}
                >
                  Concentration {selected.concentration ? '✓' : ''}
                </button>
              </div>

              {/* Conditions */}
              <div>
                <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>CONDITIONS</div>
                <div className="flex flex-wrap gap-1.5">
                  {isBloodied(selected) && (
                    <span className={`${mono} rounded-full border px-2.5 py-1.5 text-[9px]`} style={{ background: 'rgba(196,69,58,.14)', borderColor: 'rgba(196,69,58,.5)', color: 'var(--qd-danger-hi)' }}>
                      Bloodied
                    </span>
                  )}
                  {selected.concentration && (
                    <span className={`${mono} rounded-full border px-2.5 py-1.5 text-[9px]`} style={{ background: 'rgba(212,98,47,.14)', borderColor: 'rgba(212,98,47,.5)', color: 'var(--qd-accent-bright)' }}>
                      Concentrating
                    </span>
                  )}
                  {selConditions.map((c) => (
                    <span key={c} className={`${mono} rounded-full border border-[var(--qd-border-faint)] px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-[var(--qd-ink-2)]`}>
                      {c}
                    </span>
                  ))}
                  {!isBloodied(selected) && !selected.concentration && selConditions.length === 0 && (
                    <span className={`${mono} text-[9px] text-[var(--qd-ink-muted)]`}>No conditions.</span>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
