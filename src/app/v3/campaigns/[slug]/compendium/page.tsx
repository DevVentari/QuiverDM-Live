'use client';

/**
 * v3 Compendium — wired to real homebrew data via trpc.homebrew.getContent.
 * Three columns: category rail · entry list (typed, homebrew-flagged) · statblock
 * detail. The category rail filters the loaded list client-side by homebrew `type`.
 * The statblock reads the selected entry's `data` JSON defensively (the shape is a
 * free-form blob — every field guarded with optional chaining + '—' fallbacks).
 * The design's own logo/brand header is dropped — the app shell provides that chrome.
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

// Category rail → homebrew `type` filter. Conditions/Rules have no clean homebrew
// source, so they resolve to empty tabs (graceful "Nothing stirs in the archive").
const CATEGORIES = [
  { label: 'Monsters', type: 'creature' as const },
  { label: 'Spells', type: 'spell' as const },
  { label: 'Items', type: 'item' as const },
  { label: 'Conditions', type: null }, // TODO: no homebrew source for conditions
  { label: 'Rules', type: 'rule' as const },
];

// ---- Homebrew row (subset of HomebrewContent returned by homebrew.getContent) ----
interface HomebrewRow {
  id: string;
  name: string;
  type: string;
  tags?: string[] | null;
  sourceType?: string | null;
  data?: unknown;
}

const isHomebrew = (r: HomebrewRow) => (r.sourceType ?? 'manual') !== 'dndbeyond_import';

// Per-type icon for the entry list.
const ICON_FOR_TYPE: Record<string, string> = {
  creature: 'monster/aberration',
  spell: 'spell/abjuration',
  item: 'weapon/sword',
  rule: 'class/wizard',
};
const iconForType = (type: string) => ICON_FOR_TYPE[type] ?? 'monster/aberration';

// ---- Defensive statblock adapter ------------------------------------------------
type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
}

function formatCR(cr: unknown): string {
  if (cr === undefined || cr === null || cr === '') return '—';
  const n = typeof cr === 'string' ? parseFloat(cr) : (cr as number);
  if (n === 0.125) return '1/8';
  if (n === 0.25) return '1/4';
  if (n === 0.5) return '1/2';
  return String(cr);
}

interface StatBlock {
  size?: string;
  type?: string;
  alignment?: string;
  cr: string;
  xp?: number;
  ac: string;
  hp: string;
  speed: string;
  abilities: Array<{ label: string; value: string }>;
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: string;
  languages?: string;
  actions: Array<{ name: string; description: string }>;
}

/**
 * Reads a HomebrewContent.data JSON blob into a statblock. Every field is guarded —
 * the blob may have any subset of keys. AC/HP/abilities default to '—'.
 */
function adaptStatBlock(row: HomebrewRow | null): StatBlock | null {
  if (!row) return null;
  const d = (row.data ?? {}) as Record<string, unknown>;

  const rawAbilities = (d.abilities ?? {}) as Partial<Record<AbilityKey, number>>;
  const abilities = ABILITY_KEYS.map((k) => {
    const score = rawAbilities[k];
    return {
      label: k.toUpperCase(),
      value: typeof score === 'number' ? `${score} (${abilityMod(score)})` : '—',
    };
  });

  const acNote = typeof d.acNote === 'string' ? ` (${d.acNote})` : '';
  const hpDice = typeof d.hpDice === 'string' ? ` (${d.hpDice})` : '';

  const actionsRaw = Array.isArray(d.actions) ? (d.actions as Array<Record<string, unknown>>) : [];
  const actions = actionsRaw.map((a) => ({
    name: typeof a.name === 'string' ? a.name : 'Action',
    description: typeof a.description === 'string' ? a.description : '',
  }));

  const strArr = (v: unknown): string[] | undefined =>
    Array.isArray(v) && v.length ? v.map(String) : undefined;

  return {
    size: typeof d.size === 'string' ? d.size : undefined,
    type: typeof d.type === 'string' ? d.type : undefined,
    alignment: typeof d.alignment === 'string' ? d.alignment : undefined,
    cr: formatCR(d.cr),
    xp: typeof d.xp === 'number' ? d.xp : undefined,
    ac: d.ac !== undefined && d.ac !== null ? `${d.ac}${acNote}` : '—',
    hp: d.hp !== undefined && d.hp !== null ? `${d.hp}${hpDice}` : '—',
    speed: typeof d.speed === 'string' && d.speed ? d.speed : '—',
    abilities,
    damageResistances: strArr(d.damageResistances),
    damageImmunities: strArr(d.damageImmunities),
    conditionImmunities: strArr(d.conditionImmunities),
    senses: typeof d.senses === 'string' ? d.senses : undefined,
    languages: typeof d.languages === 'string' ? d.languages : undefined,
    actions,
  };
}

const PLURAL_LABEL: Record<string, string> = {
  creature: 'MONSTERS',
  spell: 'SPELLS',
  item: 'ITEMS',
  rule: 'RULES',
};

export default function CompendiumPage() {
  const { campaignId } = useCampaign();
  const [activeCat, setActiveCat] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load everything for the campaign once; filter by type/search client-side
  // (same approach as the NPC page).
  const query = trpc.homebrew.getContent.useQuery(
    { campaignId, limit: 100 },
    { staleTime: 60_000 },
  );

  const allRows = (query.data?.items as HomebrewRow[] | undefined) ?? [];

  const activeType = CATEGORIES[activeCat].type;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (activeType === null) return false; // Conditions tab → no source
      if (r.type !== activeType) return false;
      if (term && !r.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allRows, activeType, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;
  const stat = useMemo(() => adaptStatBlock(selected), [selected]);

  const listLabel = activeType ? PLURAL_LABEL[activeType] ?? activeType.toUpperCase() : '—';

  return (
    <div className="flex h-full flex-col">
      {/* slim toolbar (replaces the design's brand header) */}
      <div className="flex items-center gap-3.5 border-b border-[var(--qd-border-faint)] px-5 py-3" style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.05),transparent)' }}>
        <span className={`${mono} text-[9px] uppercase tracking-[0.08em] text-[var(--qd-ink-muted)]`}>RULES · MONSTERS · SPELLS · searchable at the table</span>
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="⌕ Search the compendium…"
          className={`${mono} w-[320px] rounded-[10px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[11px] text-[var(--qd-ink)] placeholder:text-[var(--qd-ink-faint)] focus:border-[var(--qd-border-accent)] focus:outline-none`}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== CATEGORIES ===== */}
        <aside className="flex w-[188px] flex-none flex-col gap-1 border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          {CATEGORIES.map((c, i) => {
            const active = i === activeCat;
            return (
              <button
                key={c.label}
                onClick={() => {
                  setActiveCat(i);
                  setSelectedId(null);
                }}
                className={`rounded-[9px] px-3 py-2.5 text-left text-[14px] ${display}`}
                style={
                  active
                    ? { color: 'var(--qd-ink-strong)', background: 'linear-gradient(90deg,rgba(217,138,61,.16),transparent)', border: '1px solid var(--qd-border-accent)' }
                    : { color: 'var(--qd-ink-2)' }
                }
              >
                {c.label}
              </button>
            );
          })}
          <div className={`${mono} mt-auto p-2 text-[8px] leading-[1.7] text-[var(--qd-ink-faintest)]`}>Your homebrew lives here too — flagged with a ✦.</div>
        </aside>

        {/* ===== ENTRY LIST ===== */}
        <div className="flex w-[288px] flex-none flex-col gap-[7px] overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.12)] p-3">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>{listLabel} · {filtered.length}</div>

          {query.isLoading && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">Turning the pages…</p>
          )}
          {query.error && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">The threads tangled. Try again.</p>
          )}
          {!query.isLoading && !query.error && filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">Nothing stirs in the archive.</p>
          )}

          {filtered.map((e) => {
            const active = selected?.id === e.id;
            const homebrew = isHomebrew(e);
            const meta = (e.tags && e.tags.length ? e.tags.slice(0, 2).join(' · ') : e.type).toUpperCase();
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="flex items-center gap-2.5 rounded-[11px] border p-2.5 text-left"
                style={
                  active
                    ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent-strong)' }
                    : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
                }
              >
                <span
                  className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] text-[var(--qd-ink-2)]"
                  style={{ background: 'rgba(196,69,58,.1)' }}
                >
                  <MaskedDndIcon name={iconForType(e.type)} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]" style={{ color: active ? 'var(--qd-ink-strong)' : 'var(--qd-ink)' }}>
                    {e.name}
                    {homebrew && <span className={`${mono} ml-1 text-[7px] text-[var(--qd-accent-text)]`}>✦</span>}
                  </span>
                  <span className={`${mono} block truncate text-[7.5px]`} style={{ color: active ? 'var(--qd-accent-bright)' : 'var(--qd-ink-faint)' }}>{meta}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ===== STATBLOCK ===== */}
        <div className="flex-1 overflow-auto p-6">
          {!selected || !stat ? (
            <p className="text-[var(--qd-ink-muted)]">
              {activeType === null
                ? 'No homebrew lives in this archive yet.' /* TODO: conditions source */
                : 'Choose an entry to read its lore.'}
            </p>
          ) : (
            <div
              className="rounded-[16px] border p-5"
              style={{
                borderColor: 'var(--qd-border-accent)',
                background: 'linear-gradient(180deg,rgba(36,23,18,.9),rgba(16,12,10,.9))',
                boxShadow: '0 20px 50px rgba(0,0,0,.4)',
              }}
            >
              {/* header */}
              <div className="flex items-start justify-between border-b border-[var(--qd-border-accent)] pb-3">
                <div>
                  <div className={`${display} text-[26px] leading-none text-[var(--qd-ink-strong)]`}>{selected.name}</div>
                  <div className={`${mono} mt-1.5 text-[9px] italic text-[var(--qd-accent-bright)]`}>
                    {[stat.size, stat.type, stat.alignment].filter(Boolean).join(' ') || '—'}
                    {` · CR ${stat.cr}`}
                    {stat.xp !== undefined && ` (${stat.xp.toLocaleString()} XP)`}
                    {isHomebrew(selected) && ' · ✦ homebrew'}
                  </div>
                </div>
                <button
                  className={`${display} flex-none cursor-pointer rounded-[10px] border-none px-3.5 py-2 text-[13px] font-bold text-[var(--qd-ink-strong)]`}
                  style={{ background: 'linear-gradient(180deg,var(--qd-warn),var(--qd-warn-deep))' }}
                >
                  + Add to combat
                </button>
              </div>

              {/* AC / HP / Speed */}
              <div className="mt-3.5 flex gap-6 text-[14px] text-[var(--qd-ink-2)]">
                <span><b className="text-[var(--qd-accent-hi)]">AC</b> {stat.ac}</span>
                <span><b className="text-[var(--qd-accent-hi)]">HP</b> {stat.hp}</span>
                <span><b className="text-[var(--qd-accent-hi)]">Speed</b> {stat.speed}</span>
              </div>

              {/* ability grid */}
              <div className="mt-3.5 grid grid-cols-6 gap-2">
                {stat.abilities.map((a) => (
                  <div key={a.label} className="rounded-[9px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] py-2 text-center">
                    <div className={`${mono} text-[7px] text-[var(--qd-ink-muted)]`}>{a.label}</div>
                    <div className="text-[15px] text-[var(--qd-ink-2)]">{a.value}</div>
                  </div>
                ))}
              </div>

              {/* defenses */}
              {(stat.damageResistances || stat.damageImmunities || stat.conditionImmunities || stat.senses || stat.languages) && (
                <div className="mt-3.5 text-[13.5px] leading-[1.6] text-[var(--qd-ink-2)]">
                  {(stat.damageResistances || stat.damageImmunities || stat.conditionImmunities) && (
                    <div>
                      {stat.damageResistances && <><b className="text-[var(--qd-accent-bright)]">Damage Resistances</b> {stat.damageResistances.join(', ')}</>}
                      {stat.damageImmunities && <>{stat.damageResistances ? ' · ' : ''}<b className="text-[var(--qd-accent-bright)]">Damage Immunities</b> {stat.damageImmunities.join(', ')}</>}
                      {stat.conditionImmunities && <>{(stat.damageResistances || stat.damageImmunities) ? ' · ' : ''}<b className="text-[var(--qd-accent-bright)]">Condition Immunities</b> {stat.conditionImmunities.join(', ')}</>}
                    </div>
                  )}
                  {(stat.senses || stat.languages) && (
                    <div className="mt-1">
                      {stat.senses && <><b className="text-[var(--qd-accent-bright)]">Senses</b> {stat.senses}</>}
                      {stat.languages && <>{stat.senses ? ' · ' : ''}<b className="text-[var(--qd-accent-bright)]">Languages</b> {stat.languages}</>}
                    </div>
                  )}
                </div>
              )}

              {/* actions */}
              <div className="mt-3.5 border-t border-[var(--qd-border-accent)] pt-3" style={{ borderTopColor: 'rgba(217,138,61,.2)' }}>
                {stat.actions.length === 0 ? (
                  <div className="text-[13px] text-[var(--qd-ink-muted)]">No actions recorded.</div>
                ) : (
                  stat.actions.map((a, i) => (
                    <div key={`${a.name}-${i}`} className={`text-[14px] text-[var(--qd-accent-hi)] ${i > 0 ? 'mt-2' : ''}`}>
                      <b>{a.name}.</b> <span className="text-[var(--qd-ink-2)]">{a.description}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
