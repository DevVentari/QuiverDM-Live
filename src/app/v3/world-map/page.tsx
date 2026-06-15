'use client';

/**
 * v3 World Map — rebuilt from docs/assets/designs/v3/designs/World Map HiFi.dc.html
 * on the --qd-* token system. Three columns: locations rail · map canvas (typed,
 * status-coloured pins + fog) · drill-down detail panel. Content is the design's
 * mock data, held in arrays so it wires to real campaign locations later.
 */

type Status = 'ally' | 'unstable' | 'hostile' | 'town' | 'neutral';

const STATUS: Record<Status, { dot: string; ring: string; text: string }> = {
  ally:     { dot: 'var(--qd-success)',        ring: 'var(--qd-success)',     text: 'var(--qd-success-hi)' },
  unstable: { dot: 'var(--qd-accent-bright)',  ring: 'var(--qd-accent)',      text: 'var(--qd-accent-text)' },
  hostile:  { dot: 'var(--qd-danger)',         ring: 'var(--qd-danger)',      text: 'var(--qd-danger-hi)' },
  neutral:  { dot: 'var(--qd-arcane)',         ring: 'var(--qd-arcane)',      text: 'var(--qd-arcane-bright)' },
  town:     { dot: 'var(--qd-ink-muted)',      ring: 'var(--qd-ink-muted)',   text: 'var(--qd-ink-2)' },
};

interface Loc {
  name: string;
  kind: string;
  status: Status;
  x: number;
  y: number;
  selected?: boolean;
}

const LOCATIONS: Loc[] = [
  { name: 'Concordia Stellaris', kind: 'CITY · ⚠ UNSTABLE', status: 'unstable', x: 46, y: 50, selected: true },
  { name: 'Bonfire Keep', kind: 'KEEP · ALLY', status: 'ally', x: 26, y: 26 },
  { name: 'Aurelios', kind: 'ARCANUM · NEUTRAL', status: 'neutral', x: 66, y: 32 },
  { name: 'The Reach', kind: 'RUIN · HOSTILE', status: 'hostile', x: 40, y: 74 },
  { name: 'Saltmere', kind: 'PORT · TOWN', status: 'town', x: 16, y: 56 },
];

const SCENES = [
  { name: 'The Gilded Quill', meta: 'TAVERN · no battle map', glyph: '🍺', tint: 'var(--qd-accent)', shop: true },
  { name: 'Temple of the Compact', meta: 'SCENE · RP', glyph: '🜂', tint: 'var(--qd-arcane)' },
  { name: 'The Undercrofts', meta: 'SCENE → battle map', glyph: '🕳', tint: 'var(--qd-danger)' },
];

const NPCS = [
  { name: 'Faeren', initial: 'F', from: 'var(--qd-accent)', to: 'var(--qd-danger-deep)' },
  { name: 'Valdris', initial: 'V', from: 'var(--qd-success)', to: 'var(--qd-success-deeper)' },
  { name: 'Draven', initial: 'D', from: 'var(--qd-danger)', to: 'var(--qd-danger-deep)' },
];

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

function Crumb({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={`${mono} rounded-[7px] border px-2.5 py-1.5 text-[9px] tracking-[0.1em]`}
      style={
        active
          ? { color: 'var(--qd-accent-hi)', background: 'rgba(217,138,61,.16)', borderColor: 'var(--qd-border-accent-strong)' }
          : { color: 'var(--qd-ink-faint)', borderColor: 'var(--qd-border)' }
      }
    >
      {active && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: 'var(--qd-accent)', boxShadow: '0 0 8px var(--qd-accent)' }} />}
      {label}
    </span>
  );
}

export default function WorldMapPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Layer breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[var(--qd-border-faint)] px-5 py-2.5">
        <span className={`${mono} text-[9px] uppercase tracking-[0.14em] text-[var(--qd-accent-text)]`}>The Shattered Compact · World Map</span>
        <span className="flex-1" />
        <Crumb label="WORLD" active />
        <span className="text-[11px] text-[var(--qd-ink-faintest)]">▸</span>
        <Crumb label="LOCATION MAP" />
        <span className="text-[11px] text-[var(--qd-ink-faintest)]">▸</span>
        <Crumb label="SCENE" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== LOCATIONS RAIL ===== */}
        <aside className="flex w-[218px] flex-none flex-col gap-2 overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          <div className="flex items-center justify-between px-0.5">
            <span className={`${mono} text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>LOCATIONS</span>
            <span className={`${mono} text-[9px] text-[var(--qd-accent)]`}>+ Pin</span>
          </div>
          {LOCATIONS.map((l) => (
            <button
              key={l.name}
              className="flex items-center gap-2.5 rounded-[11px] border p-2 text-left"
              style={
                l.selected
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
              }
            >
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: STATUS[l.status].dot, boxShadow: `0 0 10px ${STATUS[l.status].dot}` }} />
              <span className="min-w-0 flex-1">
                <span className="block whitespace-nowrap text-[13px] text-[var(--qd-ink-strong)]">{l.name}</span>
                <span className={`${mono} block text-[7.5px]`} style={{ color: STATUS[l.status].text }}>{l.kind}</span>
              </span>
            </button>
          ))}
          <div className="flex-1" />
          <div className="rounded-[10px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)] p-2.5">
            <div className={`${mono} mb-1.5 text-[7.5px] tracking-[0.12em] text-[var(--qd-ink-faint)]`}>PIN TYPES</div>
            <div className={`${mono} flex flex-col gap-1 text-[8.5px] text-[var(--qd-ink-muted)]`}>
              <span><span style={{ color: 'var(--qd-success)' }}>●</span> Ally / safe</span>
              <span><span style={{ color: 'var(--qd-accent-bright)' }}>●</span> Unstable / watch</span>
              <span><span style={{ color: 'var(--qd-danger)' }}>●</span> Hostile / threat</span>
            </div>
          </div>
        </aside>

        {/* ===== MAP CANVAS ===== */}
        <div className="relative flex-1 overflow-hidden" style={{ background: 'radial-gradient(560px 420px at 46% 44%, #241a12, #100c0a 82%)' }}>
          {/* art placeholder */}
          <div className="absolute inset-0 grid place-items-center">
            <span className={`${mono} text-[10px] tracking-wide text-[var(--qd-ink-faintest)]`}>drop world-map art — pins, fog &amp; labels overlay on top</span>
          </div>
          {/* parchment grain */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(58deg,rgba(255,225,190,.02) 0 2px,transparent 2px 26px),repeating-linear-gradient(122deg,rgba(255,225,190,.015) 0 2px,transparent 2px 34px)' }} />
          {/* fog region */}
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[26%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(8,6,5,.9) 50%)' }} />
          <div className={`${mono} absolute right-4 top-12 z-[4] text-[8px] tracking-[0.1em] text-[var(--qd-ink-faintest)]`}>▒ UNCHARTED · player-hidden</div>

          {/* pins */}
          {LOCATIONS.map((l) =>
            l.selected ? (
              <div key={l.name} className="absolute z-[6]" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
                <span className="v3-pin-pulse absolute left-0 top-0 h-4 w-4 rounded-full border-2" style={{ borderColor: 'var(--qd-accent)' }} />
                <span className="relative block h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: 'var(--qd-accent-hi)', background: 'radial-gradient(circle,#f6d9ad,var(--qd-accent))', boxShadow: '0 0 16px rgba(217,138,61,.9)' }} />
                {/* popover */}
                <div className="absolute left-[18px] top-[-10px] w-[228px] rounded-[12px] border p-3.5" style={{ background: '#231811', borderColor: 'var(--qd-border-accent-strong)', boxShadow: '0 18px 40px rgba(0,0,0,.6)' }}>
                  <span className="block whitespace-nowrap text-[15px] text-[var(--qd-ink-strong)]">{l.name}</span>
                  <span className={`${mono} mt-1.5 block text-[8px] tracking-[0.06em] text-[var(--qd-accent-text)]`}>⚠ UNSTABLE · REALITY TEAR</span>
                  <p className="mt-2 text-[11.5px] leading-snug text-[var(--qd-ink-2)]">The golden city of accords. Two moons, one fracture in the sky.</p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold`} style={{ background: 'rgba(217,138,61,.14)', borderColor: 'var(--qd-border-accent)', color: 'var(--qd-accent-hi)' }}>Open Location Map <span>▸</span></button>
                    <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px]`} style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-strong)', color: 'var(--qd-ink-2)' }}>Enter a Scene <span>▸</span></button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={l.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: STATUS[l.status].dot, background: `radial-gradient(circle, ${STATUS[l.status].text}, ${STATUS[l.status].dot})`, boxShadow: `0 0 12px ${STATUS[l.status].dot}` }} />
                <div className={`${mono} mt-1 whitespace-nowrap text-[8.5px]`} style={{ color: STATUS[l.status].text, textShadow: '0 1px 4px #000' }}>{l.name}</div>
              </div>
            ),
          )}

          {/* zoom controls */}
          <div className="absolute left-3.5 top-3.5 z-[5] flex flex-col gap-1.5">
            {['+', '−', '⤢'].map((c) => (
              <span key={c} className="grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] border border-[var(--qd-border-strong)] text-[15px] text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>{c}</span>
            ))}
          </div>
          {/* toggle controls */}
          <div className={`${mono} absolute right-3.5 top-3.5 z-[5] flex gap-1.5 text-[8.5px]`}>
            <span className="cursor-pointer rounded-[7px] border border-[var(--qd-border-strong)] px-2 py-1.5 text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>Labels ✓</span>
            <span className="cursor-pointer rounded-[7px] border px-2 py-1.5 text-[var(--qd-accent-text)]" style={{ background: 'rgba(0,0,0,.5)', borderColor: 'var(--qd-border-accent)' }}>Fog · DM</span>
            <span className="cursor-pointer rounded-[7px] border border-[var(--qd-border-strong)] px-2 py-1.5 text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>Player view</span>
          </div>
          <div className={`${mono} absolute bottom-3 left-3.5 z-[5] text-[8px] text-[var(--qd-ink-faintest)]`}>uploaded world map · drag pins · paint fog · scroll to zoom</div>
        </div>

        {/* ===== LOCATION DETAIL ===== */}
        <aside className="flex w-[322px] flex-none flex-col gap-3 overflow-auto border-l border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.16)] p-4">
          <div className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-accent-text)]`}>▸ SELECTED LOCATION</div>
          <div className="grid h-[120px] w-full place-items-center rounded-[12px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)]">
            <span className={`${mono} text-[9px] text-[var(--qd-ink-faintest)]`}>location art</span>
          </div>
          <div>
            <div className={`${display} text-[21px] leading-none text-[var(--qd-ink-strong)]`}>Concordia Stellaris</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`${mono} rounded-full border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[8px] tracking-[0.06em] text-[var(--qd-ink-2)]`}>CITY</span>
              <span className={`${mono} rounded-full border px-2.5 py-1 text-[8px] tracking-[0.06em]`} style={{ color: 'var(--qd-warn-hi)', background: 'rgba(212,98,47,.14)', borderColor: 'var(--qd-border-accent)' }}>⚠ UNSTABLE</span>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--qd-ink-2)]">The golden city where the Compact was signed — now bleeding reality from a tear above the amphitheater.</p>
          </div>

          <div className="border-t border-[var(--qd-border-faint)] pt-3">
            <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>INSIDE · DRILL DOWN</div>
            <button className="mb-1.5 flex w-full items-center gap-2.5 rounded-[10px] border p-2.5 text-left" style={{ background: 'rgba(217,138,61,.1)', borderColor: 'var(--qd-border-accent)' }}>
              <span className="h-6 w-6 flex-none rounded-[7px]" style={{ background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),rgba(217,138,61,.12)' }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-[var(--qd-accent-hi)]">Sacred Amphitheater District</span>
                <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>LOCATION MAP · 1</span>
              </span>
              <span className="text-[13px] text-[var(--qd-accent-hi)]">▸</span>
            </button>

            <div className={`${mono} mb-1.5 mt-2.5 text-[8px] tracking-[0.1em] text-[var(--qd-ink-faint)]`}>SCENES · 3</div>
            {SCENES.map((s) => (
              <div key={s.name} className="mb-1.5 rounded-[10px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)] p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-[6px] border text-[12px]" style={{ background: `color-mix(in oklab, ${s.tint} 12%, transparent)`, borderColor: `color-mix(in oklab, ${s.tint} 30%, transparent)` }}>{s.glyph}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-[var(--qd-ink)]">{s.name}</span>
                    <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>{s.meta}</span>
                  </span>
                  <span className="text-[13px] text-[var(--qd-ink-muted)]">▸</span>
                </div>
                {s.shop && (
                  <div className="mt-2 flex items-center gap-2 border-t border-dashed border-[var(--qd-border)] pt-2">
                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: 'var(--qd-success)', boxShadow: '0 0 7px var(--qd-success)' }} />
                    <span className={`${mono} flex-1 text-[9px] leading-snug text-[var(--qd-success-bright)]`}>Merchant known — wares &amp; prices auto-filled</span>
                    <button className={`${display} flex-none rounded-[7px] border px-2.5 py-1 text-[11px] font-bold`} style={{ background: 'rgba(95,143,69,.18)', borderColor: 'var(--qd-success-deep)', color: 'var(--qd-success-hi)' }}>Shop ▸</button>
                  </div>
                )}
              </div>
            ))}

            <div className={`${mono} mb-2 mt-3 text-[8px] tracking-[0.1em] text-[var(--qd-ink-faint)]`}>NPCS HERE · 3</div>
            <div className="flex flex-wrap gap-1.5">
              {NPCS.map((n) => (
                <span key={n.name} className="flex items-center gap-1.5 rounded-full border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.04)] py-1 pl-1 pr-2.5">
                  <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[9px] font-bold text-[var(--qd-on-accent)]" style={{ background: `radial-gradient(circle, ${n.from}, ${n.to})` }}>{n.initial}</span>
                  <span className="text-[11px] text-[var(--qd-ink-2)]">{n.name}</span>
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
