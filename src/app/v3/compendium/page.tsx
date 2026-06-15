'use client';

/**
 * v3 Compendium — rebuilt from docs/assets/designs/v3/designs/Compendium HiFi.dc.html
 * on the --qd-* token system. Three columns: category rail · entry list (typed,
 * homebrew-flagged) · statblock detail. Content is the design's mock data, held
 * in arrays so it wires to real compendium entries later. The design's own
 * logo/brand header is dropped — the app shell provides that chrome.
 */

import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

const CATEGORIES = ['Monsters', 'Spells', 'Items', 'Conditions', 'Rules'];

interface Entry {
  name: string;
  meta: string;
  icon: string;
  iconBg: string;
  iconBorder?: string;
  homebrew?: boolean;
  selected?: boolean;
  metaColor: string;
}

const ENTRIES: Entry[] = [
  {
    name: 'Void Spawn',
    meta: 'ABERRATION · CR 5',
    icon: 'monster/aberration',
    iconBg: 'rgba(196,69,58,.16)',
    iconBorder: 'rgba(196,69,58,.4)',
    homebrew: true,
    selected: true,
    metaColor: 'var(--qd-accent-bright)',
  },
  {
    name: 'Festival Guard',
    meta: 'HUMANOID · CR 1/2',
    icon: 'monster/humanoid',
    iconBg: 'rgba(196,69,58,.1)',
    metaColor: 'var(--qd-ink-faint)',
  },
  {
    name: 'Captain Draven',
    meta: 'BOSS · CR 9',
    icon: 'weapon/sword',
    iconBg: 'rgba(217,138,61,.1)',
    homebrew: true,
    metaColor: 'var(--qd-ink-faint)',
  },
  {
    name: 'Knowledge Serpent',
    meta: 'ABERRATION · CR 7',
    icon: 'monster/aberration',
    iconBg: 'rgba(176,143,208,.1)',
    metaColor: 'var(--qd-ink-faint)',
  },
];

const ABILITIES = [
  { label: 'STR', value: '14 (+2)' },
  { label: 'DEX', value: '17 (+3)' },
  { label: 'CON', value: '15 (+2)' },
  { label: 'INT', value: '8 (−1)' },
  { label: 'WIS', value: '12 (+1)' },
  { label: 'CHA', value: '6 (−2)' },
];

export default function CompendiumPage() {
  return (
    <div className="flex h-full flex-col">
      {/* slim toolbar (replaces the design's brand header) */}
      <div className="flex items-center gap-3.5 border-b border-[var(--qd-border-faint)] px-5 py-3" style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.05),transparent)' }}>
        <span className={`${mono} text-[9px] uppercase tracking-[0.08em] text-[var(--qd-ink-muted)]`}>RULES · MONSTERS · SPELLS · searchable at the table</span>
        <span className="flex-1" />
        <div className={`${mono} w-[320px] rounded-[10px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[11px] text-[var(--qd-ink-faint)]`}>⌕ Search the compendium…</div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== CATEGORIES ===== */}
        <aside className="flex w-[188px] flex-none flex-col gap-1 border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          {CATEGORIES.map((c, i) => (
            <span
              key={c}
              className={`rounded-[9px] px-3 py-2.5 text-[14px] ${display}`}
              style={
                i === 0
                  ? { color: 'var(--qd-ink-strong)', background: 'linear-gradient(90deg,rgba(217,138,61,.16),transparent)', border: '1px solid var(--qd-border-accent)' }
                  : { color: 'var(--qd-ink-2)' }
              }
            >
              {c}
            </span>
          ))}
          <div className={`${mono} mt-auto p-2 text-[8px] leading-[1.7] text-[var(--qd-ink-faintest)]`}>Your homebrew lives here too — flagged with a ✦.</div>
        </aside>

        {/* ===== ENTRY LIST ===== */}
        <div className="flex w-[288px] flex-none flex-col gap-[7px] overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.12)] p-3">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>MONSTERS · 42</div>
          {ENTRIES.map((e) => (
            <button
              key={e.name}
              className="flex items-center gap-2.5 rounded-[11px] border p-2.5 text-left"
              style={
                e.selected
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent-strong)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
              }
            >
              <span
                className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] text-[var(--qd-ink-2)]"
                style={{ background: e.iconBg, border: e.iconBorder ? `1px solid ${e.iconBorder}` : undefined }}
              >
                <MaskedDndIcon name={e.icon} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]" style={{ color: e.selected ? 'var(--qd-ink-strong)' : 'var(--qd-ink)' }}>
                  {e.name}
                  {e.homebrew && <span className={`${mono} ml-1 text-[7px] text-[var(--qd-accent-text)]`}>✦</span>}
                </span>
                <span className={`${mono} block text-[7.5px]`} style={{ color: e.metaColor }}>{e.meta}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ===== STATBLOCK ===== */}
        <div className="flex-1 overflow-auto p-6">
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
                <div className={`${display} text-[26px] leading-none text-[var(--qd-ink-strong)]`}>Void Spawn</div>
                <div className={`${mono} mt-1.5 text-[9px] italic text-[var(--qd-accent-bright)]`}>Medium aberration · chaotic · CR 5 (1,800 XP) · ✦ homebrew</div>
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
              <span><b className="text-[var(--qd-accent-hi)]">AC</b> 15</span>
              <span><b className="text-[var(--qd-accent-hi)]">HP</b> 45 (7d8+14)</span>
              <span><b className="text-[var(--qd-accent-hi)]">Speed</b> 30 ft, climb 30 ft</span>
            </div>

            {/* ability grid */}
            <div className="mt-3.5 grid grid-cols-6 gap-2">
              {ABILITIES.map((a) => (
                <div key={a.label} className="rounded-[9px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] py-2 text-center">
                  <div className={`${mono} text-[7px] text-[var(--qd-ink-muted)]`}>{a.label}</div>
                  <div className="text-[15px] text-[var(--qd-ink-2)]">{a.value}</div>
                </div>
              ))}
            </div>

            {/* defenses */}
            <div className="mt-3.5 text-[13.5px] leading-[1.6] text-[var(--qd-ink-2)]">
              <div><b className="text-[var(--qd-accent-bright)]">Damage Resistances</b> cold, necrotic · <b className="text-[var(--qd-accent-bright)]">Condition Immunities</b> charmed, frightened</div>
              <div className="mt-1"><b className="text-[var(--qd-accent-bright)]">Senses</b> darkvision 120 ft · <b className="text-[var(--qd-accent-bright)]">Languages</b> understands Deep Speech</div>
            </div>

            {/* actions */}
            <div className="mt-3.5 border-t border-[var(--qd-border-accent)] pt-3" style={{ borderTopColor: 'rgba(217,138,61,.2)' }}>
              <div className="text-[14px] text-[var(--qd-accent-hi)]">
                <b>Unravelling Touch.</b> <span className="text-[var(--qd-ink-2)]">Melee +6, reach 5 ft. 13 (2d8+3) necrotic; target&apos;s max HP reduced by the damage until a long rest.</span>
              </div>
              <div className="mt-2 text-[14px] text-[var(--qd-accent-hi)]">
                <b>Reality Bleed (Recharge 5–6).</b> <span className="text-[var(--qd-ink-2)]">15-ft cube; DC 14 Con save or 18 (4d8) psychic and blinded until end of next turn.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
