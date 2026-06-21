'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import { useHeartflame } from '@/components/shell/v3/heartflame-context';
import { primaryNudge, type SurfacedNudge } from '@/lib/heartflame';
import type { BoardParticipant } from '@/server/services/heartflame.service';
import { CONDITION_NAMES } from '@/lib/srd/conditions';

const ECONOMY: Array<{ field: 'actionUsed' | 'bonusActionUsed' | 'reactionUsed'; icon: string; label: string }> = [
  { field: 'actionUsed', icon: 'combat/action', label: 'Action' },
  { field: 'bonusActionUsed', icon: 'combat/bonus-action', label: 'Bonus' },
  { field: 'reactionUsed', icon: 'combat/reaction', label: 'Reaction' },
];

function asConditions(c: unknown): string[] {
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [];
}

// ─── Inline HP editor ────────────────────────────────────────────────────────

interface HpEditorProps {
  p: BoardParticipant;
  onSubmit: (val: number) => void;
  onClose: () => void;
}
function HpEditor({ p, onSubmit, onClose }: HpEditorProps) {
  const [raw, setRaw] = useState(String(p.hp));
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onSubmit(Math.max(0, Math.min(p.maxHp, parsed)));
    }
    onClose();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); commit(); }}
      className="inline-flex items-center gap-1"
    >
      <input
        ref={inputRef}
        autoFocus
        type="number"
        value={raw}
        min={0}
        max={p.maxHp}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className="w-[56px] rounded-[8px] border border-[var(--qd-border-accent)] bg-[var(--qd-card)] px-2 py-0.5 text-center font-[family-name:var(--qd-font-mono)] text-[13px] text-[var(--qd-ink-strong)] outline-none"
        style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
      />
      <span className="font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-ink-muted)]">
        /{p.maxHp}
      </span>
    </form>
  );
}

// ─── Initiative editor ───────────────────────────────────────────────────────

interface InitEditorProps {
  value: number;
  onSubmit: (val: number) => void;
  onClose: () => void;
}
function InitEditor({ value, onSubmit, onClose }: InitEditorProps) {
  const [raw, setRaw] = useState(String(value));

  function commit() {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onSubmit(Math.max(0, Math.min(30, parsed)));
    }
    onClose();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); commit(); }}
      className="inline-flex"
    >
      <input
        autoFocus
        type="number"
        value={raw}
        min={0}
        max={30}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className="h-8 w-10 rounded-full border border-[var(--qd-border-accent)] bg-[var(--qd-card)] text-center font-[family-name:var(--qd-font-mono)] text-[12px] text-[var(--qd-accent-text)] outline-none"
        style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
      />
    </form>
  );
}

// ─── Condition picker ─────────────────────────────────────────────────────────

interface ConditionPickerProps {
  active: string[];
  onToggle: (condition: string) => void;
  onClose: () => void;
}
function ConditionPicker({ active, onToggle, onClose }: ConditionPickerProps) {
  const set = new Set(active.map((c) => c.toLowerCase()));

  return (
    <div
      className="absolute z-20 mt-1 rounded-[12px] border border-[var(--qd-border-accent)] p-3 shadow-xl"
      style={{ background: 'var(--qd-card)', minWidth: '220px' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--qd-ink-muted)]">
          Conditions
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-[family-name:var(--qd-font-mono)] text-[10px] text-[var(--qd-ink-faint)] hover:text-[var(--qd-ink)]"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CONDITION_NAMES.map((c) => {
          const on = set.has(c.toLowerCase());
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className="rounded-full border px-2 py-0.5 font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-wide transition-colors"
              style={
                on
                  ? {
                      borderColor: 'var(--qd-border-accent)',
                      background: 'color-mix(in oklab, var(--qd-accent) 18%, transparent)',
                      color: 'var(--qd-accent-text)',
                    }
                  : {
                      borderColor: 'var(--qd-border-faint)',
                      color: 'var(--qd-ink-muted)',
                    }
              }
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add combatant form ───────────────────────────────────────────────────────

interface AddCombatantFormProps {
  encounterId: string;
  onAdded: () => void;
  onClose: () => void;
}
function AddCombatantForm({ encounterId, onAdded, onClose }: AddCombatantFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'pc' | 'npc' | 'monster'>('monster');
  const [initiative, setInitiative] = useState(10);
  const [hp, setHp] = useState(10);
  const [maxHp, setMaxHp] = useState(10);

  const addParticipant = trpc.encounters.addParticipant.useMutation({
    onSuccess: () => {
      onAdded();
      onClose();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addParticipant.mutate({
      encounterId,
      name: name.trim(),
      type,
      initiative: Math.max(0, Math.min(30, initiative)),
      hp: Math.max(0, hp),
      maxHp: Math.max(1, maxHp),
    });
  }

  const labelCls = 'font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.14em] text-[var(--qd-ink-muted)]';
  const inputCls = 'w-full rounded-[8px] border border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.25)] px-2.5 py-1.5 font-[family-name:var(--qd-font-mono)] text-[12px] text-[var(--qd-ink)] outline-none focus:border-[var(--qd-border-accent)]';
  const numCls = `${inputCls} w-[72px]`;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 rounded-t-[18px] border-t border-[var(--qd-border-accent)] p-5 shadow-2xl"
      style={{ background: 'color-mix(in oklab, var(--qd-card) 95%, transparent)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-[family-name:var(--qd-font-display)] text-[18px] text-[var(--qd-ink-strong)]">
          Add combatant
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-[family-name:var(--qd-font-mono)] text-[12px] text-[var(--qd-ink-faint)] hover:text-[var(--qd-ink)]"
        >
          ✕ Cancel
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <div className={`${labelCls} mb-1`}>Name</div>
          <input
            autoFocus
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ogre"
            maxLength={100}
            required
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <div className={`${labelCls} mb-1`}>Type</div>
            <select
              className={inputCls}
              value={type}
              onChange={(e) => setType(e.target.value as 'pc' | 'npc' | 'monster')}
            >
              <option value="monster">Monster</option>
              <option value="npc">NPC</option>
              <option value="pc">PC</option>
            </select>
          </div>
          <div>
            <div className={`${labelCls} mb-1`}>Initiative</div>
            <input
              type="number"
              className={numCls}
              value={initiative}
              min={0}
              max={30}
              onChange={(e) => setInitiative(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div>
            <div className={`${labelCls} mb-1`}>HP</div>
            <input
              type="number"
              className={numCls}
              value={hp}
              min={0}
              onChange={(e) => setHp(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <div className={`${labelCls} mb-1`}>Max HP</div>
            <input
              type="number"
              className={numCls}
              value={maxHp}
              min={1}
              onChange={(e) => setMaxHp(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!name.trim() || addParticipant.isPending}
          className="mt-1 rounded-[10px] border border-[var(--qd-border-accent)] px-4 py-2 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-accent-text)] transition-colors hover:bg-[var(--qd-card)] disabled:opacity-50"
        >
          {addParticipant.isPending ? 'Adding…' : 'Add to encounter'}
        </button>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CombatPage() {
  const { campaignId } = useCampaign();
  const { setNudge } = useHeartflame();
  const utils = trpc.useUtils();
  const board = trpc.heartflame.getCampaignBoard.useQuery({ campaignId }, { staleTime: 0 });

  const invalidateBoard = () => utils.heartflame.getCampaignBoard.invalidate({ campaignId });

  const setState = trpc.heartflame.setParticipantState.useMutation({
    onSuccess: (res) => {
      invalidateBoard();
      setNudge(primaryNudge(res.nudges) as SurfacedNudge | null);
    },
  });

  const updateParticipant = trpc.encounters.updateParticipant.useMutation({
    onSuccess: invalidateBoard,
  });

  // Round / lifecycle controls reuse the real, ownership-checked encounter service.
  const nextRound = trpc.encounters.nextRound.useMutation({ onSuccess: invalidateBoard });
  const complete = trpc.encounters.complete.useMutation({
    onSuccess: () => { invalidateBoard(); setNudge(null); },
  });

  const patch = (p: BoardParticipant, data: Record<string, unknown>) =>
    setState.mutate({ participantId: p.id, patch: data });

  // Per-card UI state
  const [editingHpId, setEditingHpId] = useState<string | null>(null);
  const [editingInitId, setEditingInitId] = useState<string | null>(null);
  const [condPickerId, setCondPickerId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  function toggleCondition(p: BoardParticipant, condition: string) {
    const current = asConditions(p.conditions);
    const lc = condition.toLowerCase();
    const has = current.some((c) => c.toLowerCase() === lc);
    const next = has
      ? current.filter((c) => c.toLowerCase() !== lc)
      : [...current, condition];
    patch(p, { conditions: next });
  }

  if (board.isLoading) {
    return <div className="px-8 py-16 text-[var(--qd-ink-muted)]">Gathering the combatants…</div>;
  }
  if (!board.data) {
    // No active encounter in this campaign — a real, expected state, not an error.
    return (
      <div className="mx-auto max-w-3xl px-8 py-16">
        <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--qd-ink-faint)]">
          Combat
        </span>
        <h1 className="mt-1 font-[family-name:var(--qd-font-display)] text-[34px] leading-tight text-[var(--qd-ink-strong)]">
          No blades are drawn.
        </h1>
        <p className="mt-3 max-w-[44ch] text-[var(--qd-text-body-sm)] text-[var(--qd-ink-muted)]">
          The chronicle is quiet. When an encounter is set to <em>active</em> on one of this
          campaign&apos;s sessions, its initiative order and the Heartflame&apos;s watch appear here.
        </p>
      </div>
    );
  }

  const { id: encounterId, name, round, participants } = board.data;

  return (
    <div className="relative mx-auto max-w-3xl px-8 py-10">
      <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--qd-ink-faint)]">
        Combat · Round {round}
      </span>
      <div className="mt-1 flex items-start gap-4">
        <h1 className="flex-1 font-[family-name:var(--qd-font-display)] text-[34px] leading-tight text-[var(--qd-ink-strong)]">
          {name}
        </h1>
        <div className="flex flex-none items-center gap-2 pt-2">
          <button
            type="button"
            data-testid="add-combatant"
            onClick={() => setShowAddForm(true)}
            className="rounded-[10px] border border-[var(--qd-border-faint)] px-3 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-ink-muted)] transition-colors hover:border-[var(--qd-border-accent)] hover:text-[var(--qd-accent-text)]"
          >
            + Add
          </button>
          <button
            type="button"
            onClick={() => nextRound.mutate({ encounterId })}
            disabled={nextRound.isPending}
            className="rounded-[10px] border border-[var(--qd-border-accent)] px-3 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-accent-text)] transition-colors hover:bg-[var(--qd-card)] disabled:opacity-50"
          >
            End round ▸
          </button>
          <button
            type="button"
            onClick={() => complete.mutate({ encounterId })}
            disabled={complete.isPending}
            className="rounded-[10px] border border-[var(--qd-border-faint)] px-3 py-1.5 font-[family-name:var(--qd-font-mono)] text-[11px] text-[var(--qd-ink-muted)] transition-colors hover:border-[var(--qd-border-accent)] disabled:opacity-50"
          >
            End combat
          </button>
        </div>
      </div>
      <p className="mt-2 text-[var(--qd-text-body-sm)] text-[var(--qd-ink-muted)]">
        Toggle action economy or take damage — the Heartflame watches from the margin (bottom-right).
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {participants.map((p) => {
          const bloodied = p.maxHp > 0 && p.hp <= Math.floor(p.maxHp / 2);
          const conditions = asConditions(p.conditions);
          const isEditingHp = editingHpId === p.id;
          const isEditingInit = editingInitId === p.id;
          const isPickingCond = condPickerId === p.id;

          return (
            <div
              key={p.id}
              className="rounded-[14px] border border-[var(--qd-border-faint)] p-4"
              style={{ background: 'var(--qd-grad-card), var(--qd-card)' }}
            >
              <div className="flex items-center gap-3">
                {/* Initiative — click to edit (uses encounters.updateParticipant) */}
                {isEditingInit ? (
                  <InitEditor
                    value={p.initiative}
                    onSubmit={(val) => updateParticipant.mutate({ participantId: p.id, initiative: val })}
                    onClose={() => setEditingInitId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    title="Click to edit initiative"
                    onClick={() => { setEditingInitId(p.id); setEditingHpId(null); setCondPickerId(null); }}
                    className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--qd-border-accent)] font-[family-name:var(--qd-font-mono)] text-xs text-[var(--qd-accent-text)] transition-colors hover:bg-[color-mix(in_oklab,var(--qd-accent)_12%,transparent)]"
                  >
                    {p.initiative}
                  </button>
                )}

                <span className="flex-1 font-[family-name:var(--qd-font-display)] text-[20px] text-[var(--qd-ink)]">
                  {p.name}
                </span>

                {/* HP — click to edit arbitrary value */}
                {isEditingHp ? (
                  <HpEditor
                    p={p}
                    onSubmit={(val) => patch(p, { hp: val })}
                    onClose={() => setEditingHpId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    title="Click to set HP"
                    onClick={() => { setEditingHpId(p.id); setEditingInitId(null); setCondPickerId(null); }}
                    className="flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    style={{ color: bloodied ? 'var(--qd-danger-bright)' : 'var(--qd-success)' }}
                  >
                    <span className="font-[family-name:var(--qd-font-mono)] text-sm">
                      {p.hp}/{p.maxHp}
                    </span>
                    {bloodied && (
                      <span className="font-[family-name:var(--qd-font-mono)] text-[10px] uppercase tracking-wide">
                        bloodied
                      </span>
                    )}
                  </button>
                )}
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

                {/* Quick HP nudges */}
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

              {/* Conditions row — display + picker trigger */}
              <div className="relative mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={`Remove ${c}`}
                      onClick={() => toggleCondition(p, c)}
                      className="rounded-full border border-[var(--qd-border-accent)] px-2 py-0.5 font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-wide transition-colors hover:border-[var(--qd-danger-bright)] hover:text-[var(--qd-danger-bright)]"
                      style={{
                        background: 'color-mix(in oklab, var(--qd-accent) 12%, transparent)',
                        color: 'var(--qd-accent-text)',
                      }}
                    >
                      {c} ×
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCondPickerId(isPickingCond ? null : p.id);
                      setEditingHpId(null);
                      setEditingInitId(null);
                    }}
                    className="rounded-full border border-dashed border-[var(--qd-border-faint)] px-2 py-0.5 font-[family-name:var(--qd-font-mono)] text-[9px] text-[var(--qd-ink-faint)] transition-colors hover:border-[var(--qd-border-accent)] hover:text-[var(--qd-accent-text)]"
                  >
                    {conditions.length === 0 ? '+ condition' : '+ more'}
                  </button>
                </div>

                {isPickingCond && (
                  <ConditionPicker
                    active={conditions}
                    onToggle={(c) => toggleCondition(p, c)}
                    onClose={() => setCondPickerId(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add combatant slide-up form */}
      {showAddForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-[rgba(0,0,0,0.5)]"
            onClick={() => setShowAddForm(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl">
            <AddCombatantForm
              encounterId={encounterId}
              onAdded={invalidateBoard}
              onClose={() => setShowAddForm(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
