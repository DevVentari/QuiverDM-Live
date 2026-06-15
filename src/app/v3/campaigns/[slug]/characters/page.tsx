'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

// ---------------------------------------------------------------------------
// Typed adapters — Character fields are JSON blobs, so read everything
// defensively with optional chaining and '—' fallbacks.
// ---------------------------------------------------------------------------

interface AbilityScores {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}
interface HitPoints {
  current?: number;
  max?: number;
  temp?: number;
}
interface Currency {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

// Shape of the nested character inside a CampaignCharacter row (list query).
interface CharacterLite {
  id: string;
  name: string;
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
  userId?: string | null;
  abilityScores?: AbilityScores | null;
  hitPoints?: HitPoints | null;
  armorClass?: number | null;
}

interface CampaignCharacterRow {
  id: string;
  status?: string | null;
  dmNotes?: string | null;
  character: CharacterLite;
}

// Full sheet returned by characters.getById (owner only). Superset of lite.
interface CharacterFull extends CharacterLite {
  background?: string | null;
  speed?: number | null;
  proficiencyBonus?: number | null;
  features?: unknown;
  proficiencies?: unknown;
  inventory?: unknown;
  spellcasting?: unknown;
  savingThrows?: unknown;
  skills?: unknown;
  currency?: Currency | null;
  languages?: unknown;
  backstory?: string | null;
  personalityTraits?: string | null;
  notes?: string | null;
}

const ABILITIES = [
  { key: 'str', label: 'STR', name: 'Strength', icon: 'ability/strength' },
  { key: 'dex', label: 'DEX', name: 'Dexterity', icon: 'ability/dexterity' },
  { key: 'con', label: 'CON', name: 'Constitution', icon: 'ability/constitution' },
  { key: 'int', label: 'INT', name: 'Intelligence', icon: 'ability/intelligence' },
  { key: 'wis', label: 'WIS', name: 'Wisdom', icon: 'ability/wisdom' },
  { key: 'cha', label: 'CHA', name: 'Charisma', icon: 'ability/charisma' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--qd-success)',
  pending: 'var(--qd-warn)',
  retired: 'var(--qd-ink-muted)',
  deceased: 'var(--qd-danger)',
};
const statusColor = (s?: string | null) =>
  STATUS_COLOR[(s ?? 'active').toLowerCase()] ?? 'var(--qd-ink-muted)';

const modifier = (score?: number | null): string => {
  if (typeof score !== 'number') return '—';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const classLine = (c: CharacterLite): string => {
  const cls = c.subclass ? `${c.class} (${c.subclass})` : c.class;
  const lvl = typeof c.level === 'number' ? `Lv ${c.level}` : null;
  return [cls || null, lvl].filter(Boolean).join(' · ') || '—';
};

// Coerce assorted JSON feature/proficiency blobs into a flat string list.
function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (typeof o.name === 'string') return o.name;
          if (typeof o.label === 'string') return o.label;
        }
        return null;
      })
      .filter((v): v is string => Boolean(v));
  }
  if (typeof value === 'string') return value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>);
  return [];
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function StatBlock({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-qd-lg border border-qd-faint p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
      <MaskedDndIcon name={icon} size={22} className="text-qd-accent" />
      <div className="min-w-0">
        <div className="font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">{label}</div>
        <div className="font-qd-display text-xl leading-none text-qd-ink-strong">{value}</div>
        {sub && <div className="font-qd-mono text-[8px] text-qd-ink-muted">{sub}</div>}
      </div>
    </div>
  );
}

function Section({ icon, label, items, empty }: { icon: string; label: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-qd-lg border border-qd-faint p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="mb-2.5 flex items-center gap-2">
        <MaskedDndIcon name={icon} size={14} className="text-qd-accent" />
        <span className="font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">{label}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-qd-body-sm italic text-qd-ink-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={`${it}-${i}`} className="rounded-full border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-qd-mono text-[9px] text-qd-ink-2">
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail pane — pulls the full sheet via getById, falling back to the list
// row's lite data when getById is forbidden (DM viewing a player's character).
// ---------------------------------------------------------------------------

function CharacterSheet({ row, isDM }: { row: CampaignCharacterRow; isDM: boolean }) {
  const lite = row.character;
  const full = trpc.characters.getById.useQuery(
    { id: lite.id },
    { staleTime: 60_000, retry: false },
  );

  const sheet: CharacterFull = useMemo(() => {
    // Prefer the full owner sheet; otherwise fall back to the lite list data.
    const base = (full.data as CharacterFull | undefined) ?? lite;
    return { ...lite, ...base };
  }, [full.data, lite]);

  const abilities = (sheet.abilityScores ?? {}) as AbilityScores;
  const hp = (sheet.hitPoints ?? {}) as HitPoints;
  const currency = (sheet.currency ?? {}) as Currency;

  const hpLine =
    typeof hp.current === 'number' && typeof hp.max === 'number'
      ? `${hp.current} / ${hp.max}${hp.temp ? ` (+${hp.temp})` : ''}`
      : '—';

  const coinLine = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .map((k) => (currency[k] ? `${currency[k]} ${k}` : null))
    .filter(Boolean)
    .join(' · ');

  const features = toStringList(sheet.features);
  const proficiencies = toStringList(sheet.proficiencies);
  const inventory = toStringList(sheet.inventory);
  const languages = toStringList(sheet.languages);
  const skills = toStringList(sheet.skills);
  const savingThrows = toStringList(sheet.savingThrows);

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* HEADER */}
      <div className="flex gap-5">
        <div className="grid h-[180px] w-[140px] flex-none place-items-center overflow-hidden rounded-qd-xl border border-qd-faint bg-[rgba(255,255,255,0.02)]">
          {lite.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lite.portraitUrl} alt={lite.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-qd-display text-4xl text-qd-ink-faintest">{lite.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-qd-display text-[30px] leading-none text-qd-ink-strong">{lite.name}</div>
          <div className="mt-2 font-qd-mono text-[11px] uppercase tracking-[0.08em] text-qd-ink-muted">
            {[lite.race || null, classLine(lite)].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sheet.background && (
              <span className="rounded-full border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-qd-mono text-[9px] text-qd-ink-2">
                {sheet.background}
              </span>
            )}
            {row.status && (
              <span
                className="rounded-full px-2.5 py-1 font-qd-mono text-[9px]"
                style={{ color: statusColor(row.status), borderColor: statusColor(row.status), borderWidth: 1, background: 'rgba(255,255,255,.03)' }}
              >
                {row.status.toUpperCase()}
              </span>
            )}
          </div>
          {sheet.personalityTraits && (
            <p className="mt-3 max-w-[560px] text-qd-body leading-relaxed text-qd-ink-2">{sheet.personalityTraits}</p>
          )}
        </div>
      </div>

      {/* ABILITY SCORES */}
      <div className="mt-6 grid grid-cols-6 gap-2.5">
        {ABILITIES.map((a) => {
          const score = abilities[a.key];
          return (
            <div key={a.key} className="flex flex-col items-center rounded-qd-lg border border-qd-faint p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
              <MaskedDndIcon name={a.icon} size={20} className="text-qd-accent" />
              <div className="mt-1.5 font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">{a.label}</div>
              <div className="font-qd-display text-2xl leading-none text-qd-ink-strong">{typeof score === 'number' ? score : '—'}</div>
              <div className="font-qd-mono text-[11px] text-qd-accent-text">{modifier(score)}</div>
            </div>
          );
        })}
      </div>

      {/* COMBAT STATS */}
      <div className="mt-3.5 grid grid-cols-4 gap-2.5">
        <StatBlock icon="attribute/ac" label="Armor Class" value={typeof sheet.armorClass === 'number' ? `${sheet.armorClass}` : '—'} />
        <StatBlock icon="hp/blood" label="Hit Points" value={hpLine} />
        <StatBlock icon="movement/walking" label="Speed" value={typeof sheet.speed === 'number' ? `${sheet.speed} ft` : '—'} />
        <StatBlock icon="combat/bonus-action" label="Proficiency" value={typeof sheet.proficiencyBonus === 'number' ? `+${sheet.proficiencyBonus}` : '—'} />
      </div>

      {/* SAVES + SKILLS */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <Section icon="attribute/saving-throw" label="Saving Throws" items={savingThrows} empty="No proficient saves recorded." />
        <Section icon="attribute/skillcheck" label="Skills" items={skills} empty="No skill proficiencies recorded." />
      </div>

      {/* FEATURES / PROFICIENCIES / LANGUAGES / INVENTORY */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <Section icon="entity/scroll" label="Features & Traits" items={features} empty="No features recorded." />
        <Section icon="proficiency/proficient" label="Proficiencies" items={proficiencies} empty="No proficiencies recorded." />
        <Section icon="entity/book" label="Languages" items={languages} empty="No languages recorded." />
        <Section icon="entity/pack" label="Inventory" items={inventory} empty="The pack is empty." />
      </div>

      {/* CURRENCY */}
      <div className="mt-3.5 rounded-qd-lg border border-qd-faint p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
        <div className="mb-2 flex items-center gap-2">
          <MaskedDndIcon name="util/trade" size={14} className="text-qd-accent" />
          <span className="font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">Coin Purse</span>
        </div>
        <div className="font-qd-mono text-qd-body-sm text-qd-ink-2">{coinLine || '—'}</div>
      </div>

      {/* DM-ONLY NOTES */}
      {isDM && (
        <div
          className="mt-3.5 rounded-qd-lg border border-qd-accent p-4"
          style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' }}
        >
          <div className="mb-2 font-qd-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: 'var(--qd-accent-text)' }}>
            ▸ DM Notes
          </div>
          <div className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">
            {row.dmNotes || sheet.notes || 'No private notes on this soul yet.'}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — list (party roster) + detail (DM sheet)
// ---------------------------------------------------------------------------

export default function CharactersPage() {
  const { campaignId, isDM } = useCampaign();
  const chars = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, { staleTime: 60_000 });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = (chars.data as CampaignCharacterRow[] | undefined) ?? [];
  const filtered = useMemo(
    () => rows.filter((r) => r.character.name.toLowerCase().includes(search.trim().toLowerCase())),
    [rows, search],
  );
  const selected = filtered.find((r) => r.character.id === selectedId) ?? filtered[0] ?? null;

  if (chars.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Gathering the party…</div>;
  }
  if (chars.error) {
    return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">The Party</div>
          <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
            {rows.length} {rows.length === 1 ? 'hero' : 'heroes'}
          </div>
        </div>
        <span className="flex-1" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ROSTER */}
        <aside className="flex w-[282px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="⌕ Search the party…"
            className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 font-qd-mono text-[11px] text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
          />
          {filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No souls walk this world yet.</p>
          )}
          {filtered.map((r) => {
            const c = r.character;
            const active = selected?.character.id === c.id;
            const col = statusColor(r.status);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(c.id)}
                className="flex items-center gap-2.5 rounded-qd-lg border p-2 text-left transition-colors"
                style={
                  active
                    ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                    : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
                }
              >
                <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full text-[13px] font-bold text-qd-on-accent" style={{ background: `radial-gradient(circle, ${col}, var(--qd-danger-deep))` }}>
                  {c.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.portraitUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    c.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-qd-ink-strong">{c.name}</span>
                  <span className="block truncate font-qd-mono text-[7.5px] text-qd-ink-muted">{classLine(c).toUpperCase()}</span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* DETAIL */}
        {!selected ? (
          <div className="flex-1 overflow-auto p-6">
            <p className="text-qd-ink-muted">Select a hero from the party.</p>
          </div>
        ) : (
          <CharacterSheet key={selected.character.id} row={selected} isDM={isDM} />
        )}
      </div>
    </div>
  );
}
