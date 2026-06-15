'use client';

/**
 * v3 World Map — rebuilt from docs/assets/designs/v3/designs/World Map HiFi.dc.html
 * on the --qd-* token system. Three columns: locations rail · map canvas (typed,
 * status-coloured pins + fog) · drill-down detail panel.
 *
 * Wired to live data (mirrors the NPC v3 page pattern):
 *  - Rail + pins   → brain.entities.list({ type: 'LOCATION' }) — WorldEntity rows
 *    (name, status, properties, mapPins[0].x/y).
 *  - Detail panel  → worldMap.getLocationDetail({ entityId }) for the selected
 *    location (relationships → "NPCs here", sessionAppearances → "Scenes").
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

type Status = 'ally' | 'unstable' | 'hostile' | 'town' | 'neutral';

const STATUS: Record<Status, { dot: string; ring: string; text: string }> = {
  ally:     { dot: 'var(--qd-success)',        ring: 'var(--qd-success)',     text: 'var(--qd-success-hi)' },
  unstable: { dot: 'var(--qd-accent-bright)',  ring: 'var(--qd-accent)',      text: 'var(--qd-accent-text)' },
  hostile:  { dot: 'var(--qd-danger)',         ring: 'var(--qd-danger)',      text: 'var(--qd-danger-hi)' },
  neutral:  { dot: 'var(--qd-arcane)',         ring: 'var(--qd-arcane)',      text: 'var(--qd-arcane-bright)' },
  town:     { dot: 'var(--qd-ink-muted)',      ring: 'var(--qd-ink-muted)',   text: 'var(--qd-ink-2)' },
};

// WorldEntityStatus (active/dormant/destroyed/resolved) → design pin colour.
const STATUS_FROM_ENTITY: Record<string, Status> = {
  active: 'ally',
  dormant: 'unstable',
  destroyed: 'hostile',
  resolved: 'town',
};
const statusOf = (s?: string | null): Status => STATUS_FROM_ENTITY[(s ?? 'active').toLowerCase()] ?? 'neutral';
const statusLabel = (s: Status): string =>
  s === 'ally' ? 'ALLY' : s === 'unstable' ? '⚠ UNSTABLE' : s === 'hostile' ? 'HOSTILE' : s === 'town' ? 'TOWN' : 'NEUTRAL';

// Real WorldEntity row shape (subset returned by brain.entities.list).
interface LocationRow {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  type?: string;
  properties?: Record<string, unknown> | null;
  mapPins?: Array<{ id: string; mapId: string; x: number; y: number }>;
}

interface Loc {
  id: string;
  name: string;
  kind: string;
  status: Status;
  description: string;
  x: number;
  y: number;
}

// Deterministic fallback grid so unpinned locations still scatter across the
// canvas while keeping the design's pin visuals. // TODO: real pin coords (drag pins → mapPin.x/y).
function fallbackXY(index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const rowN = Math.floor(index / cols);
  return {
    x: 22 + col * 22 + (rowN % 2) * 6,
    y: 24 + rowN * 20,
  };
}

const propString = (props: Record<string, unknown> | null | undefined, key: string): string | undefined => {
  const v = props?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

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
  const { campaignId, slug } = useCampaign();
  const locationsQuery = trpc.brain.entities.list.useQuery(
    { campaignId, type: 'LOCATION' },
    { staleTime: 60_000 },
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = (locationsQuery.data as LocationRow[] | undefined) ?? [];
  const locations: Loc[] = useMemo(
    () =>
      rows.map((r, i) => {
        const status = statusOf(r.status);
        const kind = propString(r.properties, 'kind') ?? propString(r.properties, 'category') ?? 'LOCATION';
        const pin = r.mapPins?.[0];
        const xy = pin ? { x: pin.x, y: pin.y } : fallbackXY(i);
        return {
          id: r.id,
          name: r.name,
          kind: `${kind.toUpperCase()} · ${statusLabel(status)}`,
          status,
          description: r.description ?? '',
          x: xy.x,
          y: xy.y,
        };
      }),
    [rows],
  );

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;

  // Detail panel: relationships → "NPCs here", sessionAppearances → "Scenes".
  const detailQuery = trpc.worldMap.getLocationDetail.useQuery(
    { campaignId, entityId: selected?.id ?? '' },
    { staleTime: 60_000, enabled: !!selected?.id },
  );
  const detail = detailQuery.data;

  // NPCs related to the selected location (typed adapter over relationship edges).
  const relatedNpcs = useMemo(() => {
    if (!detail) return [] as Array<{ id: string; name: string }>;
    const out: Array<{ id: string; name: string }> = [];
    for (const r of detail.fromRelationships ?? []) {
      if (r.toEntity?.type === 'NPC') out.push({ id: r.toEntity.id, name: r.toEntity.name });
    }
    for (const r of detail.toRelationships ?? []) {
      if (r.fromEntity?.type === 'NPC') out.push({ id: r.fromEntity.id, name: r.fromEntity.name });
    }
    return out.slice(0, 8);
  }, [detail]);

  // Scenes-per-location: no first-class model yet — surface session appearances. // TODO: real scenes.
  const scenes = useMemo(
    () =>
      (detail?.sessionAppearances ?? []).map((a) => ({
        id: a.id,
        name: a.session?.title ?? `Session ${a.session?.sessionNumber ?? '—'}`,
        meta: (a.role ?? 'SCENE').toUpperCase(),
      })),
    [detail],
  );

  if (locationsQuery.isLoading) {
    return <div className={`${mono} px-8 py-16 text-[var(--qd-ink-muted)]`}>Charting the world…</div>;
  }
  if (locationsQuery.error) {
    return <div className={`${mono} px-8 py-16 text-[var(--qd-ink-muted)]`}>The threads tangled. Try again.</div>;
  }

  const selectedStatusText = selected ? STATUS[selected.status].text : 'var(--qd-ink-2)';

  return (
    <div className="flex h-full flex-col">
      {/* Layer breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[var(--qd-border-faint)] px-5 py-2.5">
        <span className={`${mono} text-[9px] uppercase tracking-[0.14em] text-[var(--qd-accent-text)]`}>{slug} · World Map</span>
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
          {locations.length === 0 && (
            <p className={`${mono} px-1 py-6 text-center text-[10px] text-[var(--qd-ink-muted)]`}>No places charted yet.</p>
          )}
          {locations.map((l) => {
            const active = selected?.id === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="flex items-center gap-2.5 rounded-[11px] border p-2 text-left"
                style={
                  active
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
            );
          })}
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
          {/* fog region — // TODO: real fog state per location/region */}
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[26%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(8,6,5,.9) 50%)' }} />
          <div className={`${mono} absolute right-4 top-12 z-[4] text-[8px] tracking-[0.1em] text-[var(--qd-ink-faintest)]`}>▒ UNCHARTED · player-hidden</div>

          {/* pins */}
          {locations.map((l) => {
            const isSelected = selected?.id === l.id;
            return isSelected ? (
              <div key={l.id} className="absolute z-[6]" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
                <span className="v3-pin-pulse absolute left-0 top-0 h-4 w-4 rounded-full border-2" style={{ borderColor: 'var(--qd-accent)' }} />
                <span className="relative block h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: 'var(--qd-accent-hi)', background: 'radial-gradient(circle,#f6d9ad,var(--qd-accent))', boxShadow: '0 0 16px rgba(217,138,61,.9)' }} />
                {/* popover */}
                <div className="absolute left-[18px] top-[-10px] w-[228px] rounded-[12px] border p-3.5" style={{ background: '#231811', borderColor: 'var(--qd-border-accent-strong)', boxShadow: '0 18px 40px rgba(0,0,0,.6)' }}>
                  <span className="block whitespace-nowrap text-[15px] text-[var(--qd-ink-strong)]">{l.name}</span>
                  <span className={`${mono} mt-1.5 block text-[8px] tracking-[0.06em]`} style={{ color: STATUS[l.status].text }}>{statusLabel(l.status)}</span>
                  {l.description && (
                    <p className="mt-2 text-[11.5px] leading-snug text-[var(--qd-ink-2)]">{l.description}</p>
                  )}
                  <div className="mt-3 flex flex-col gap-1.5">
                    <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold`} style={{ background: 'rgba(217,138,61,.14)', borderColor: 'var(--qd-border-accent)', color: 'var(--qd-accent-hi)' }}>Open Location Map <span>▸</span></button>
                    <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px]`} style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-strong)', color: 'var(--qd-ink-2)' }}>Enter a Scene <span>▸</span></button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={l.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: STATUS[l.status].dot, background: `radial-gradient(circle, ${STATUS[l.status].text}, ${STATUS[l.status].dot})`, boxShadow: `0 0 12px ${STATUS[l.status].dot}` }} />
                <div className={`${mono} mt-1 whitespace-nowrap text-[8.5px]`} style={{ color: STATUS[l.status].text, textShadow: '0 1px 4px #000' }}>{l.name}</div>
              </div>
            );
          })}

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
          {!selected ? (
            <p className={`${mono} text-[10px] text-[var(--qd-ink-muted)]`}>No places charted yet.</p>
          ) : (
            <>
              <div className="grid h-[120px] w-full place-items-center overflow-hidden rounded-[12px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)]">
                {detail?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={detail.imageUrl} alt={selected.name} className="h-full w-full object-cover" />
                ) : (
                  <span className={`${mono} text-[9px] text-[var(--qd-ink-faintest)]`}>location art</span>
                )}
              </div>
              <div>
                <div className={`${display} text-[21px] leading-none text-[var(--qd-ink-strong)]`}>{selected.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`${mono} rounded-full border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[8px] tracking-[0.06em] text-[var(--qd-ink-2)]`}>{selected.kind.split(' · ')[0]}</span>
                  <span className={`${mono} rounded-full border px-2.5 py-1 text-[8px] tracking-[0.06em]`} style={{ color: selectedStatusText, background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-accent)' }}>{statusLabel(selected.status)}</span>
                </div>
                {(detail?.description ?? selected.description) && (
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--qd-ink-2)]">{detail?.description ?? selected.description}</p>
                )}
              </div>

              <div className="border-t border-[var(--qd-border-faint)] pt-3">
                <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>INSIDE · DRILL DOWN</div>
                <button className="mb-1.5 flex w-full items-center gap-2.5 rounded-[10px] border p-2.5 text-left" style={{ background: 'rgba(217,138,61,.1)', borderColor: 'var(--qd-border-accent)' }}>
                  <span className="h-6 w-6 flex-none rounded-[7px]" style={{ background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),rgba(217,138,61,.12)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-[var(--qd-accent-hi)]">{selected.name} · Location Map</span>
                    <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>LOCATION MAP</span>
                  </span>
                  <span className="text-[13px] text-[var(--qd-accent-hi)]">▸</span>
                </button>

                <div className={`${mono} mb-1.5 mt-2.5 text-[8px] tracking-[0.1em] text-[var(--qd-ink-faint)]`}>SCENES · {scenes.length}</div>
                {scenes.length === 0 && (
                  <p className={`${mono} mb-1.5 text-[9px] text-[var(--qd-ink-muted)]`}>No scenes recorded yet.</p>
                )}
                {scenes.map((s) => (
                  <div key={s.id} className="mb-1.5 rounded-[10px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)] p-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-6 w-6 flex-none place-items-center rounded-[6px] border text-[12px]" style={{ background: 'color-mix(in oklab, var(--qd-arcane) 12%, transparent)', borderColor: 'color-mix(in oklab, var(--qd-arcane) 30%, transparent)' }}>🜂</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-[var(--qd-ink)]">{s.name}</span>
                        <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>{s.meta}</span>
                      </span>
                      <span className="text-[13px] text-[var(--qd-ink-muted)]">▸</span>
                    </div>
                  </div>
                ))}

                <div className={`${mono} mb-2 mt-3 text-[8px] tracking-[0.1em] text-[var(--qd-ink-faint)]`}>NPCS HERE · {relatedNpcs.length}</div>
                {relatedNpcs.length === 0 ? (
                  <p className={`${mono} text-[9px] text-[var(--qd-ink-muted)]`}>No souls tied here yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {relatedNpcs.map((n) => (
                      <span key={n.id} className="flex items-center gap-1.5 rounded-full border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.04)] py-1 pl-1 pr-2.5">
                        <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[9px] font-bold text-[var(--qd-on-accent)]" style={{ background: 'radial-gradient(circle, var(--qd-accent), var(--qd-danger-deep))' }}>{n.name.charAt(0).toUpperCase()}</span>
                        <span className="text-[11px] text-[var(--qd-ink-2)]">{n.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
