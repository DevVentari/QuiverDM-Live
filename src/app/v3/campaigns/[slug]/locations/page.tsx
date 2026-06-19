'use client';

/**
 * v3 Locations — non-map list view of places, rebuilt from
 * docs/assets/designs/v3/designs/Locations HiFi.dc.html on the --qd-* token system.
 * Two columns: locations rail (name + type/status) · selected location detail
 * (banner art / placeholder, name, status tags, description, who's-here NPCs,
 * appears-in sessions).
 *
 * Wired to live data (mirrors the NPC + World Map v3 pages):
 *  - Rail    → brain.entities.list({ type: 'LOCATION' }) — WorldEntity rows
 *    (name, description, status, properties, imageUrl).
 *  - Detail  → worldMap.getLocationDetail({ entityId }) for the selected location
 *    (relationships → "Who's here" NPCs, sessionAppearances → "Appears in").
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

// WorldEntityStatus → status colour + label (per task spec).
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--qd-success)',
  dormant: 'var(--qd-warn)',
  destroyed: 'var(--qd-danger)',
  resolved: 'var(--qd-ink-muted)',
};
const statusColor = (s?: string | null) =>
  STATUS_COLOR[(s ?? '').toLowerCase()] ?? 'var(--qd-ink-muted)';
const statusLabel = (s?: string | null) => (s ?? 'UNKNOWN').toUpperCase();

// Location icons that exist under public/icons/dnd/location/*. Anything else
// falls back to a literal glyph so we never reference a missing mask file.
const LOCATION_ICONS = new Set([
  'bastion', 'camp', 'castle', 'dungeon', 'forest', 'hut', 'mountain', 'portal', 'tavern', 'tower', 'village',
]);
// Map common location "kind" strings → the closest available icon.
const KIND_ICON: Record<string, string> = {
  city: 'castle', town: 'village', village: 'village', keep: 'castle', castle: 'castle',
  fort: 'bastion', bastion: 'bastion', ruin: 'dungeon', dungeon: 'dungeon', cave: 'dungeon',
  forest: 'forest', wood: 'forest', wilds: 'forest', mountain: 'mountain', peak: 'mountain',
  port: 'village', harbor: 'village', tavern: 'tavern', inn: 'tavern', arcanum: 'tower',
  tower: 'tower', spire: 'tower', portal: 'portal', gate: 'portal', camp: 'camp', hut: 'hut',
};
const iconForKind = (kind: string): string | null => {
  const k = kind.toLowerCase();
  if (LOCATION_ICONS.has(k)) return `location/${k}`;
  const mapped = KIND_ICON[k];
  return mapped ? `location/${mapped}` : null;
};

// Real WorldEntity row shape (subset returned by brain.entities.list).
interface LocationRow {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  type?: string;
  imageUrl?: string | null;
  properties?: Record<string, unknown> | null;
}

// Defensive string read out of the freeform JSON `properties` blob.
const propString = (props: Record<string, unknown> | null | undefined, key: string): string | undefined => {
  const v = props?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
};
const propList = (props: Record<string, unknown> | null | undefined, key: string): string[] => {
  const v = props?.[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim());
  return [];
};

interface Loc {
  id: string;
  name: string;
  kind: string;
  status?: string | null;
  description: string;
  imageUrl?: string | null;
  properties?: Record<string, unknown> | null;
}

function InfoCard({ label, children, secret }: { label: string; children: React.ReactNode; secret?: boolean }) {
  return (
    <div
      className="rounded-qd-lg border p-4"
      style={
        secret
          ? { borderColor: 'var(--qd-border-accent)', background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' }
          : { borderColor: 'var(--qd-border-faint)', background: 'rgba(255,255,255,.02)' }
      }
    >
      <div
        className={`${mono} mb-2 text-[8px] uppercase tracking-[0.12em]`}
        style={{ color: secret ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}
      >
        {secret ? '▸ ' : ''}{label}
      </div>
      <div className={`text-qd-body-sm leading-relaxed text-qd-ink-2 ${secret ? 'italic' : ''}`}>{children}</div>
    </div>
  );
}

export default function LocationsPage() {
  const { campaignId, isDM } = useCampaign();
  const locationsQuery = trpc.brain.entities.list.useQuery(
    { campaignId, type: 'LOCATION' },
    { staleTime: 60_000 },
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = (locationsQuery.data as LocationRow[] | undefined) ?? [];
  const locations: Loc[] = useMemo(
    () =>
      rows.map((r) => {
        const kind =
          propString(r.properties, 'kind') ?? propString(r.properties, 'category') ?? 'LOCATION';
        return {
          id: r.id,
          name: r.name,
          kind,
          status: r.status,
          description: r.description ?? '',
          imageUrl: r.imageUrl,
          properties: r.properties,
        };
      }),
    [rows],
  );

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;

  // Detail panel: relationships → "Who's here" NPCs, sessionAppearances → "Appears in".
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

  // Sessions this location appears in.
  const appearances = useMemo(
    () =>
      (detail?.sessionAppearances ?? []).map((a) => ({
        id: a.id,
        name: a.session?.title ?? `Session ${a.session?.sessionNumber ?? '—'}`,
        meta: (a.role ?? 'APPEARS').toUpperCase(),
      })),
    [detail],
  );

  // "Places within" / "Hooks" have no first-class model yet — read from JSON. // TODO: real nested places + hooks models.
  const placesWithin = useMemo(
    () => (selected ? propList(selected.properties, 'placesWithin').concat(propList(selected.properties, 'places')) : []),
    [selected],
  );
  const hooks = useMemo(
    () => (selected ? propString(selected.properties, 'hooks') : undefined),
    [selected],
  );
  // DM-only secret, if recorded in JSON. // TODO: first-class secret field on WorldEntity.
  const secret = useMemo(
    () => (selected ? propString(selected.properties, 'secret') ?? propString(selected.properties, 'dmSecret') : undefined),
    [selected],
  );

  if (locationsQuery.isLoading) {
    return <div className={`${mono} px-8 py-16 text-qd-ink-muted`}>Charting the world…</div>;
  }
  if (locationsQuery.error) {
    return <div className={`${mono} px-8 py-16 text-qd-ink-muted`}>The threads tangled. Try again.</div>;
  }

  const bannerImg = detail?.imageUrl ?? selected?.imageUrl ?? null;
  const selStatusColor = statusColor(selected?.status);

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Locations</div>
          <div className={`${mono} text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>
            {locations.length} {locations.length === 1 ? 'place' : 'places'}
          </div>
        </div>
        <span className="flex-1" />
        <button className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">
          + New location
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== LIST ===== */}
        <aside className="flex w-[280px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          {locations.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No places charted yet.</p>
          )}
          {locations.map((l) => {
            const active = selected?.id === l.id;
            const col = statusColor(l.status);
            const icon = iconForKind(l.kind);
            return (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="flex items-center gap-2.5 rounded-qd-lg border p-2 text-left transition-colors"
                style={
                  active
                    ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                    : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }
                }
              >
                <span
                  className="grid h-[30px] w-[30px] flex-none place-items-center rounded-qd-md text-[13px]"
                  style={{ background: `radial-gradient(circle, color-mix(in oklab, ${col} 22%, transparent), #14100d)`, color: col }}
                >
                  {icon ? <MaskedDndIcon name={icon} size={15} /> : '◆'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-qd-ink-strong">{l.name}</span>
                  <span className={`${mono} block truncate text-[7.5px]`} style={{ color: col }}>
                    {l.kind.toUpperCase()} · {statusLabel(l.status)}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* ===== DETAIL ===== */}
        <div className="flex-1 overflow-auto pb-6">
          {!selected ? (
            <p className="px-6 py-16 text-qd-ink-muted">Select a place to chart.</p>
          ) : (
            <>
              {/* banner */}
              <div className="relative h-[200px] overflow-hidden">
                {bannerImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={bannerImg} alt={selected.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[rgba(255,255,255,0.02)]">
                    <span className={`${mono} text-[10px] text-qd-ink-faintest`}>drop location banner art</span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(16,11,9,.2),rgba(16,11,9,.96))' }} />
                <div className="absolute bottom-[18px] left-6">
                  <div className={`${display} text-[30px] leading-none text-qd-ink-strong`} style={{ textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>
                    {selected.name}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className={`${mono} rounded-full border border-qd-strong bg-[rgba(20,12,10,0.7)] px-2.5 py-1 text-[9px] text-qd-ink-2`}>
                      {selected.kind.toUpperCase()}
                    </span>
                    {selected.status && (
                      <span
                        className={`${mono} rounded-full px-2.5 py-1 text-[9px]`}
                        style={{ color: selStatusColor, borderColor: selStatusColor, borderWidth: 1, background: 'rgba(255,255,255,.03)' }}
                      >
                        {statusLabel(selected.status)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-[18px] right-6 flex gap-2">
                  <button className="rounded-qd-md bg-qd-accent px-3.5 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">Open map ▸</button>
                </div>
              </div>

              <div className="px-6 pt-5">
                {(detail?.description ?? selected.description) && (
                  <p className="max-w-[680px] text-qd-body leading-relaxed text-qd-ink-2">
                    {detail?.description ?? selected.description}
                  </p>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3.5">
                  {/* Who's here */}
                  <InfoCard label={`Who's here · ${relatedNpcs.length}`}>
                    {relatedNpcs.length === 0 ? (
                      'No souls tied here yet.'
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {relatedNpcs.map((n) => (
                          <span key={n.id} className="flex items-center gap-1.5 rounded-full border border-qd-faint bg-[rgba(255,255,255,0.04)] py-1 pl-1 pr-2.5">
                            <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[9px] font-bold text-qd-on-accent" style={{ background: 'radial-gradient(circle, var(--qd-accent), var(--qd-danger-deep))' }}>
                              {n.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-qd-ink-2">{n.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </InfoCard>

                  {/* Appears in (sessions) */}
                  <InfoCard label={`Appears in · ${appearances.length}`}>
                    {appearances.length === 0 ? (
                      'No scenes recorded yet.'
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {appearances.map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <span className="text-[11px] text-qd-ink">{a.name}</span>
                            <span className={`${mono} text-[8px] text-qd-ink-muted`}>{a.meta}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>

                  {/* Places within (JSON-backed) */}
                  {placesWithin.length > 0 && (
                    <InfoCard label="Places within">
                      <div className="flex flex-wrap gap-1.5">
                        {placesWithin.map((p) => (
                          <span key={p} className={`${mono} rounded-qd-md border border-qd-faint bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[9px] text-qd-ink-2`}>{p}</span>
                        ))}
                      </div>
                    </InfoCard>
                  )}

                  {/* Hooks (JSON-backed) */}
                  {hooks && <InfoCard label="Hooks">{hooks}</InfoCard>}

                  {/* DM secret — DM only */}
                  {isDM && (
                    <InfoCard label="DM Secret" secret>
                      {secret || 'No secret recorded.'}
                    </InfoCard>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
