'use client';

/**
 * v3 Location Map — rebuilt from
 * docs/assets/designs/v3/designs/Location Map HiFi.dc.html on the --qd-* token
 * system. This is Layer 2: the "inside a location" view (a district / city of
 * typed sub-places) that sits between the World Map and a Scene.
 *
 * Wired to live data (mirrors the World Map + NPC v3 page patterns):
 *  - Canvas + pins → worldMap.getOrCreateRoot / worldMap.getMap load a
 *    CampaignMap and its MapPins (real x/y). Pins represent LOCATION entities.
 *  - Rail          → brain.entities.list({ type: 'LOCATION' }) names/statuses
 *    the locations those pins point at.
 *  - Detail panel  → worldMap.getLocationDetail({ entityId }) for the selected
 *    place (relationships → "NPCs here", sessionAppearances → "Scenes").
 *  - Drill-down    → worldMap.listMaps; if a child CampaignMap has
 *    parentLocationId === selected place, offer "Go deeper ▸".
 *
 * Renders ONLY inner content (the v3 shell provides chrome). h-full flex.
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

type Status = 'ally' | 'unstable' | 'hostile' | 'neutral' | 'town';

const STATUS: Record<Status, { dot: string; text: string }> = {
  ally:     { dot: 'var(--qd-success)',       text: 'var(--qd-success-hi)' },
  unstable: { dot: 'var(--qd-accent-bright)', text: 'var(--qd-accent-text)' },
  hostile:  { dot: 'var(--qd-danger)',        text: 'var(--qd-danger-hi)' },
  neutral:  { dot: 'var(--qd-arcane)',        text: 'var(--qd-arcane-bright)' },
  town:     { dot: 'var(--qd-ink-muted)',     text: 'var(--qd-ink-2)' },
};

// WorldEntityStatus (active/dormant/destroyed/resolved) → design pin colour.
const STATUS_FROM_ENTITY: Record<string, Status> = {
  active: 'ally',
  dormant: 'unstable',
  destroyed: 'hostile',
  resolved: 'town',
};
const statusOf = (s?: string | null): Status =>
  STATUS_FROM_ENTITY[(s ?? 'active').toLowerCase()] ?? 'neutral';
const statusLabel = (s: Status): string =>
  s === 'ally' ? 'SAFE' : s === 'unstable' ? '⚠ UNSTABLE' : s === 'hostile' ? 'HOSTILE' : s === 'town' ? 'TOWN' : 'NEUTRAL';

// Location icons that exist on disk under public/icons/dnd/location/*.
const LOCATION_ICONS = new Set([
  'bastion', 'camp', 'castle', 'dungeon', 'forest', 'hut',
  'mountain', 'portal', 'tavern', 'tower', 'village',
]);
const KIND_TO_ICON: Record<string, string> = {
  tavern: 'tavern', shop: 'tavern', inn: 'tavern',
  dungeon: 'dungeon', undercroft: 'dungeon', crypt: 'dungeon',
  temple: 'tower', shrine: 'tower', tower: 'tower',
  castle: 'castle', keep: 'castle', fortress: 'castle', amphitheater: 'castle',
  market: 'village', village: 'village', town: 'village', district: 'village',
  forest: 'forest', wilds: 'forest',
  mountain: 'mountain', camp: 'camp', portal: 'portal', docks: 'portal',
};
function iconFor(kind: string): string | null {
  const k = kind.toLowerCase();
  for (const key of Object.keys(KIND_TO_ICON)) {
    if (k.includes(key)) return `location/${KIND_TO_ICON[key]}`;
  }
  return LOCATION_ICONS.has(k) ? `location/${k}` : null;
}

// Real WorldEntity row shape (subset returned by brain.entities.list).
interface EntityRow {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  type?: string;
  properties?: Record<string, unknown> | null;
}

// Real MapPin shape (subset returned by worldMap.getMap / getOrCreateRoot).
interface MapPinRow {
  id: string;
  x: number;
  y: number;
  entityId: string | null;
  entity?: { id: string; name: string; type: string; properties?: unknown } | null;
}

interface Place {
  id: string;       // entity id
  pinId: string | null;
  name: string;
  kind: string;
  status: Status;
  description: string;
  x: number;
  y: number;
  hasRealCoords: boolean;
}

// Deterministic fallback grid so unpinned places still scatter across the
// canvas. // TODO: real coords — drag pins to write MapPin.x/y.
function fallbackXY(index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const rowN = Math.floor(index / cols);
  return { x: 24 + col * 24 + (rowN % 2) * 8, y: 26 + rowN * 22 };
}

const propString = (props: Record<string, unknown> | null | undefined, key: string): string | undefined => {
  const v = props?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
};

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
      {active && (
        <span
          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ background: 'var(--qd-accent)', boxShadow: '0 0 8px var(--qd-accent)' }}
        />
      )}
      {label}
    </span>
  );
}

export default function LocationMapPage() {
  const { campaignId, slug } = useCampaign();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Map + its pins (real x/y). getOrCreateRoot returns the root CampaignMap.
  const rootQuery = trpc.worldMap.getOrCreateRoot.useQuery({ campaignId }, { staleTime: 60_000 });
  // Location entities (names, statuses, descriptions) for the rail + detail.
  const locationsQuery = trpc.brain.entities.list.useQuery(
    { campaignId, type: 'LOCATION' },
    { staleTime: 60_000 },
  );

  const map = rootQuery.data ?? null;
  const pins = (map?.pins as MapPinRow[] | undefined) ?? [];
  const entityRows = (locationsQuery.data as EntityRow[] | undefined) ?? [];

  // Index pins by entityId so we can read real coords when a location is pinned.
  const pinByEntity = useMemo(() => {
    const m = new Map<string, MapPinRow>();
    for (const p of pins) if (p.entityId) m.set(p.entityId, p);
    return m;
  }, [pins]);

  // Build the place list from LOCATION entities; carry real pin coords where
  // present, deterministic fallback grid otherwise.
  const places: Place[] = useMemo(
    () =>
      entityRows.map((r, i) => {
        const status = statusOf(r.status);
        const kind =
          propString(r.properties, 'kind') ??
          propString(r.properties, 'category') ??
          propString(r.properties, 'locationType') ??
          'PLACE';
        const pin = pinByEntity.get(r.id);
        const xy = pin ? { x: pin.x, y: pin.y } : fallbackXY(i);
        return {
          id: r.id,
          pinId: pin?.id ?? null,
          name: r.name,
          kind,
          status,
          description: r.description ?? '',
          x: xy.x,
          y: xy.y,
          hasRealCoords: !!pin,
        };
      }),
    [entityRows, pinByEntity],
  );

  const selected = places.find((p) => p.id === selectedId) ?? places[0] ?? null;

  // Detail panel: relationships → "NPCs here", sessionAppearances → "Scenes".
  const detailQuery = trpc.worldMap.getLocationDetail.useQuery(
    { campaignId, entityId: selected?.id ?? '' },
    { staleTime: 60_000, enabled: !!selected?.id },
  );
  const detail = detailQuery.data ?? null;

  // Drill-down: does a child CampaignMap point at the selected place?
  const mapsQuery = trpc.worldMap.listMaps.useQuery({ campaignId }, { staleTime: 60_000 });
  const childMap = useMemo(() => {
    if (!selected) return null;
    return (mapsQuery.data ?? []).find((m) => m.parentLocationId === selected.id) ?? null;
  }, [mapsQuery.data, selected]);

  // NPCs tied to the selected place (typed adapter over relationship edges).
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

  // Scenes inside this place — no first-class scene model yet, surface session
  // appearances. // TODO: real scenes.
  const scenes = useMemo(
    () =>
      (detail?.sessionAppearances ?? []).map((a) => ({
        id: a.id,
        name: a.session?.title ?? `Session ${a.session?.sessionNumber ?? '—'}`,
        meta: (a.role ?? 'SCENE').toUpperCase(),
      })),
    [detail],
  );

  // --- States: loading / error / empty -------------------------------------
  const isLoading = rootQuery.isLoading || locationsQuery.isLoading;
  if (isLoading) {
    return <div className={`${mono} px-8 py-16 text-[var(--qd-ink-muted)]`}>Charting these streets…</div>;
  }
  if (rootQuery.error || locationsQuery.error) {
    return <div className={`${mono} px-8 py-16 text-[var(--qd-ink-muted)]`}>The threads tangled. Try again.</div>;
  }

  const selectedStatusText = selected ? STATUS[selected.status].text : 'var(--qd-ink-2)';

  return (
    <div className="flex h-full flex-col">
      {/* Layer breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[var(--qd-border-faint)] px-5 py-2.5">
        <span className={`${mono} text-[9px] uppercase tracking-[0.14em] text-[var(--qd-accent-text)]`}>
          {slug} · {map?.name ?? 'Location Map'}
        </span>
        <span className="flex-1" />
        <Crumb label="WORLD" />
        <span className="text-[11px] text-[var(--qd-ink-faintest)]">▸</span>
        <Crumb label="LOCATION MAP" active />
        <span className="text-[11px] text-[var(--qd-ink-faintest)]">▸</span>
        <Crumb label="SCENE" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== SUB-LOCATIONS RAIL ===== */}
        <aside className="flex w-[218px] flex-none flex-col gap-2 overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          <div className="flex items-center justify-between px-0.5">
            <span className={`${mono} text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>PLACES · {places.length}</span>
            <span className={`${mono} text-[9px] text-[var(--qd-accent)]`}>+ Add</span>
          </div>

          {places.length === 0 && (
            <p className={`${mono} px-1 py-6 text-center text-[10px] text-[var(--qd-ink-muted)]`}>This place is uncharted.</p>
          )}

          {places.map((p) => {
            const active = selected?.id === p.id;
            const icon = iconFor(p.kind);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="flex items-center gap-2.5 rounded-[11px] border p-2 text-left"
                style={
                  active
                    ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                    : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
                }
              >
                <span
                  className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[6px] border text-[11px]"
                  style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-faint)', color: STATUS[p.status].text }}
                >
                  {icon ? <MaskedDndIcon name={icon} size={14} /> : '◆'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[13px] text-[var(--qd-ink-strong)]">{p.name}</span>
                  <span className={`${mono} block text-[7.5px] uppercase`} style={{ color: STATUS[p.status].text }}>
                    {p.kind} · {statusLabel(p.status)}
                  </span>
                </span>
              </button>
            );
          })}

          <div className="flex-1" />
          {/* Legend */}
          <div className="rounded-[10px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)] p-2.5">
            <div className={`${mono} mb-1.5 text-[7.5px] tracking-[0.12em] text-[var(--qd-ink-faint)]`}>PIN TYPES</div>
            <div className={`${mono} flex flex-col gap-1 text-[8.5px] text-[var(--qd-ink-muted)]`}>
              <span><span style={{ color: 'var(--qd-success)' }}>●</span> Safe / known</span>
              <span><span style={{ color: 'var(--qd-accent-bright)' }}>●</span> Unstable / watch</span>
              <span><span style={{ color: 'var(--qd-danger)' }}>●</span> Hostile / threat</span>
            </div>
          </div>
        </aside>

        {/* ===== DISTRICT MAP CANVAS ===== */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{ background: 'radial-gradient(560px 420px at 48% 46%, #241a12, #100c0a 82%)' }}
        >
          {/* art placeholder / uploaded background */}
          {map?.backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={map.backgroundUrl} alt={map.name ?? 'Location map'} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <span className={`${mono} text-[10px] tracking-wide text-[var(--qd-ink-faintest)]`}>
                drop district-map art — streets, pins &amp; fog overlay on top
              </span>
            </div>
          )}

          {/* street grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'repeating-linear-gradient(58deg,rgba(255,225,190,.025) 0 2px,transparent 2px 30px),repeating-linear-gradient(122deg,rgba(255,225,190,.02) 0 2px,transparent 2px 38px)' }}
          />
          {/* main road */}
          <div
            className="pointer-events-none absolute left-[8%] top-[62%] h-3.5 w-[78%] rotate-[-7deg]"
            style={{ background: 'linear-gradient(90deg,rgba(217,138,61,.12),rgba(217,138,61,.05))', borderTop: '1px solid rgba(255,235,205,.06)', borderBottom: '1px solid rgba(255,235,205,.06)' }}
          />

          {/* fog region — // TODO: real fog state per place/region */}
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 w-[24%]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(8,6,5,.9) 52%)' }}
          />
          <div className={`${mono} absolute right-4 top-12 z-[4] text-[8px] tracking-[0.1em] text-[var(--qd-ink-faintest)]`}>▒ UNEXPLORED · player-hidden</div>

          {/* pins */}
          {places.map((p) => {
            const isSelected = selected?.id === p.id;
            const icon = iconFor(p.kind);
            return isSelected ? (
              <div key={p.id} className="absolute z-[6]" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <span className="v3-pin-pulse absolute left-0 top-0 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border-2" style={{ borderColor: 'var(--qd-accent)' }} />
                <span
                  className="relative grid h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[9px] border-2 text-[15px] text-[var(--qd-on-accent)]"
                  style={{ borderColor: 'var(--qd-accent-hi)', background: 'radial-gradient(circle,#f6d9ad,var(--qd-accent))', boxShadow: '0 0 18px rgba(217,138,61,.9)' }}
                >
                  {icon ? <MaskedDndIcon name={icon} size={16} /> : '◆'}
                </span>
                {/* popover */}
                <div
                  className="absolute left-[22px] top-[-10px] w-[226px] rounded-[12px] border p-3.5"
                  style={{ background: '#231811', borderColor: 'var(--qd-border-accent-strong)', boxShadow: '0 18px 40px rgba(0,0,0,.6)' }}
                >
                  <span className="block whitespace-nowrap text-[15px] text-[var(--qd-ink-strong)]">{p.name}</span>
                  <span className={`${mono} mt-1.5 block text-[8px] uppercase tracking-[0.06em]`} style={{ color: STATUS[p.status].text }}>
                    {p.kind} · {statusLabel(p.status)}
                  </span>
                  {p.description && (
                    <p className="mt-2 text-[11.5px] leading-snug text-[var(--qd-ink-2)]">{p.description}</p>
                  )}
                  <div className="mt-3 flex flex-col gap-1.5">
                    {childMap ? (
                      <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold`} style={{ background: 'rgba(217,138,61,.14)', borderColor: 'var(--qd-border-accent)', color: 'var(--qd-accent-hi)' }}>
                        Go deeper <span>▸</span>
                      </button>
                    ) : (
                      <button className={`${display} flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[12px]`} style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-strong)', color: 'var(--qd-ink-2)' }}>
                        Enter a Scene <span>▸</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <span
                  className="grid h-[26px] w-[26px] place-items-center rounded-[8px] border-2 text-[12px]"
                  style={{ borderColor: STATUS[p.status].dot, background: `color-mix(in oklab, ${STATUS[p.status].dot} 16%, transparent)`, boxShadow: `0 0 12px ${STATUS[p.status].dot}`, color: STATUS[p.status].text }}
                >
                  {icon ? <MaskedDndIcon name={icon} size={13} /> : '◆'}
                </span>
                <div className={`${mono} mt-1 whitespace-nowrap text-[8.5px]`} style={{ color: STATUS[p.status].text, textShadow: '0 1px 4px #000' }}>{p.name}</div>
              </div>
            );
          })}

          {/* zoom controls — // TODO: real zoom/drag */}
          <div className="absolute left-3.5 top-3.5 z-[5] flex flex-col gap-1.5">
            {['+', '−'].map((c) => (
              <span key={c} className="grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] border border-[var(--qd-border-strong)] text-[15px] text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>{c}</span>
            ))}
          </div>
          {/* toggle controls */}
          <div className={`${mono} absolute right-3.5 top-3.5 z-[5] flex gap-1.5 text-[8.5px]`}>
            <span className="cursor-pointer rounded-[7px] border border-[var(--qd-border-strong)] px-2 py-1.5 text-[var(--qd-ink-2)]" style={{ background: 'rgba(0,0,0,.5)' }}>Labels ✓</span>
            <span className="cursor-pointer rounded-[7px] border px-2 py-1.5 text-[var(--qd-accent-text)]" style={{ background: 'rgba(0,0,0,.5)', borderColor: 'var(--qd-border-accent)' }}>Fog · DM</span>
          </div>
          <div className={`${mono} absolute bottom-3 left-3.5 z-[5] text-[8px] text-[var(--qd-ink-faintest)]`}>
            district of {slug} · drag pins · click to drill in
          </div>
        </div>

        {/* ===== PLACE DETAIL ===== */}
        <aside className="flex w-[322px] flex-none flex-col gap-3 overflow-auto border-l border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.16)] p-4">
          <div className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-accent-text)]`}>▸ SELECTED PLACE</div>

          {!selected ? (
            <p className={`${mono} text-[10px] text-[var(--qd-ink-muted)]`}>This place is uncharted.</p>
          ) : (
            <>
              <div className="grid h-[120px] w-full place-items-center overflow-hidden rounded-[12px] border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.02)]">
                {detail?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.imageUrl} alt={selected.name} className="h-full w-full object-cover" />
                ) : (
                  <span className={`${mono} text-[9px] text-[var(--qd-ink-faintest)]`}>place art</span>
                )}
              </div>

              <div>
                <div className={`${display} text-[21px] leading-none text-[var(--qd-ink-strong)]`}>{selected.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`${mono} rounded-full border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[8px] uppercase tracking-[0.06em] text-[var(--qd-ink-2)]`}>{selected.kind}</span>
                  <span className={`${mono} rounded-full border px-2.5 py-1 text-[8px] tracking-[0.06em]`} style={{ color: selectedStatusText, background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-accent)' }}>{statusLabel(selected.status)}</span>
                  {!selected.hasRealCoords && (
                    <span className={`${mono} rounded-full border border-[var(--qd-border-faint)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[8px] tracking-[0.06em] text-[var(--qd-ink-faint)]`}>UNPINNED</span>
                  )}
                </div>
                {(detail?.description ?? selected.description) && (
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--qd-ink-2)]">{detail?.description ?? selected.description}</p>
                )}
              </div>

              <div className="border-t border-[var(--qd-border-faint)] pt-3">
                <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>INSIDE · DRILL DOWN</div>

                {/* Drill-down to a deeper child map, if one exists */}
                {childMap ? (
                  <button className="mb-1.5 flex w-full items-center gap-2.5 rounded-[10px] border p-2.5 text-left" style={{ background: 'rgba(217,138,61,.1)', borderColor: 'var(--qd-border-accent)' }}>
                    <span className="h-6 w-6 flex-none rounded-[7px]" style={{ background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 1px,transparent 1px 6px),rgba(217,138,61,.12)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-[var(--qd-accent-hi)]">Go deeper — {childMap.name}</span>
                      <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>CHILD MAP</span>
                    </span>
                    <span className="text-[13px] text-[var(--qd-accent-hi)]">▸</span>
                  </button>
                ) : (
                  <button className="mb-1.5 flex w-full items-center gap-2.5 rounded-[10px] border p-2.5 text-left" style={{ background: 'rgba(255,255,255,.03)', borderColor: 'var(--qd-border-faint)' }}>
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-[7px] text-[12px]" style={{ background: 'rgba(217,138,61,.1)', color: 'var(--qd-accent-text)' }}>🜂</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-[var(--qd-ink-2)]">Enter the Scene</span>
                      <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>SCENE · no battle map</span>
                    </span>
                    <span className="text-[13px] text-[var(--qd-ink-muted)]">▸</span>
                  </button>
                )}

                {/* Scenes inside this place */}
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

                {/* NPCs here */}
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
