'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

// Real NPC row shape (subset of the Prisma NPC model returned by npcs.getAll).
interface NpcRow {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  faction?: string | null;
  tags?: string[] | null;
  status?: string | null;
  location?: string | null;
  motivation?: string | null;
  personality?: { traits?: string[]; bonds?: string[]; ideals?: string[]; flaws?: string[] } | null;
  secrets?: string | null;
  imageUrl?: string | null;
}

// Brain WorldEntity subset (from brain.entities.list).
interface BrainEntity {
  id: string;
  name: string;
}

// Brain WorldRelationship subset (from brain.relationships.list — includes both endpoints).
interface BrainRelationship {
  id: string;
  type: string;
  fromEntityId: string;
  toEntityId: string;
  fromEntity?: { id: string; name: string } | null;
  toEntity?: { id: string; name: string } | null;
}

// One rendered tie: the entity on the *other* end of a relationship + its type.
interface RelationView {
  id: string;
  otherName: string;
  type: string;
}

// Filter pill facet for the NPC list.
type NpcFacet = 'all' | 'ally' | 'threat';

/** Classify an NPC into the ally/threat/neutral bucket based on tags + status. */
function classifyNpc(n: NpcRow): NpcFacet {
  const tagLower = (n.tags ?? []).map((t) => t.toLowerCase());
  const allyKeywords = ['ally', 'friend', 'friendly', 'companion', 'contact'];
  const threatKeywords = ['threat', 'villain', 'enemy', 'antagonist', 'boss', 'traitor'];
  if (allyKeywords.some((k) => tagLower.some((t) => t.includes(k)))) return 'ally';
  if (threatKeywords.some((k) => tagLower.some((t) => t.includes(k)))) return 'threat';
  // Fallback: dead/fled/captured NPCs lean threat; alive is neutral (neither pill)
  return 'all';
}

const STATUS_COLOR: Record<string, string> = {
  alive: 'var(--qd-success)',
  dead: 'var(--qd-danger)',
  missing: 'var(--qd-warn)',
  captured: 'var(--qd-warn)',
  fled: 'var(--qd-warn)',
  unknown: 'var(--qd-ink-muted)',
};
const statusColor = (s?: string | null) => STATUS_COLOR[(s ?? 'unknown').toLowerCase()] ?? 'var(--qd-ink-muted)';
const subtitleOf = (n: NpcRow) => (n.role || n.faction || n.tags?.[0] || '—').toUpperCase();

function InfoCard({ label, children, secret }: { label: string; children: React.ReactNode; secret?: boolean }) {
  return (
    <div
      className={`rounded-qd-lg border p-4 ${secret ? 'border-qd-accent' : 'border-qd-faint'}`}
      style={secret ? { background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' } : { background: 'rgba(255,255,255,.02)' }}
    >
      <div className="mb-2 font-qd-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: secret ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}>
        {secret ? '▸ ' : ''}{label}
      </div>
      <div className={`text-qd-body-sm leading-relaxed ${secret ? 'italic text-qd-ink-2' : 'text-qd-ink-2'}`}>{children}</div>
    </div>
  );
}

export default function NpcsPage() {
  const { campaignId, isDM } = useCampaign();
  const npcs = trpc.npcs.getAll.useQuery({ campaignId }, { staleTime: 60_000 });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [facet, setFacet] = useState<NpcFacet>('all');

  const rows = (npcs.data as NpcRow[] | undefined) ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((n) => {
      if (q && !n.name.toLowerCase().includes(q)) return false;
      if (facet !== 'all' && classifyNpc(n) !== facet) return false;
      return true;
    });
  }, [rows, search, facet]);
  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

  // Relationships live in the brain WorldRelationship graph (keyed by WorldEntity),
  // not on the legacy NPC model. Both brain queries are DM-gated server-side.
  // Find the matching brain NPC entity by name (case-insensitive), then list its ties.
  const brainNpcsQ = trpc.brain.entities.list.useQuery(
    { campaignId, type: 'NPC' },
    { staleTime: 120_000, enabled: isDM && !!selected },
  );

  const matchedEntity = useMemo<BrainEntity | null>(() => {
    if (!selected) return null;
    const target = selected.name.trim().toLowerCase();
    if (!target) return null;
    const entities = (brainNpcsQ.data as BrainEntity[] | undefined) ?? [];
    return entities.find((e) => (e.name ?? '').trim().toLowerCase() === target) ?? null;
  }, [brainNpcsQ.data, selected]);

  const relsQ = trpc.brain.relationships.list.useQuery(
    { campaignId, entityId: matchedEntity?.id ?? '' },
    { staleTime: 120_000, enabled: isDM && !!matchedEntity },
  );

  const relations = useMemo<RelationView[]>(() => {
    const entityId = matchedEntity?.id;
    if (!entityId) return [];
    const rows = (relsQ.data as BrainRelationship[] | undefined) ?? [];
    return rows
      .map((r) => {
        // Surface the entity on the *other* end of the tie.
        const other = r.fromEntityId === entityId ? r.toEntity : r.fromEntity;
        const otherName = (other?.name ?? '').trim();
        if (!otherName) return null;
        return { id: r.id, otherName, type: (r.type ?? '').trim() || 'tied to' };
      })
      .filter((r): r is RelationView => r !== null);
  }, [relsQ.data, matchedEntity]);

  if (npcs.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Gathering the cast…</div>;
  }
  if (npcs.error) {
    return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <MaskedDndIcon name="entity/person" size={22} className="text-qd-accent-text flex-none" />
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Cast of Characters</div>
          <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">{rows.length} NPCs</div>
        </div>
        <span className="flex-1" />
        <button className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">+ New NPC</button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* LIST */}
        <aside className="flex w-[282px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="⌕ Search NPCs…"
            className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 font-qd-mono text-[11px] text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
          />
          {/* Filter pills */}
          <div className="flex gap-1.5 px-0.5" role="group" aria-label="Filter NPCs">
            {(['all', 'ally', 'threat'] as NpcFacet[]).map((f) => {
              const label = f === 'all' ? 'All' : f === 'ally' ? 'Allies' : 'Threats';
              const active = facet === f;
              return (
                <button
                  key={f}
                  onClick={() => setFacet(f)}
                  className={`min-h-[44px] min-w-0 flex-1 rounded-qd-md border font-qd-mono text-[8.5px] uppercase tracking-[0.06em] transition-colors ${
                    active
                      ? 'bg-[rgba(217,138,61,.12)] border-qd-accent text-qd-accent-text'
                      : 'border-qd-faint text-qd-ink-2 hover:border-qd-strong hover:text-qd-ink'
                  }`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No souls walk this world yet.</p>
          )}
          {filtered.map((n) => {
            const active = selected?.id === n.id;
            const col = statusColor(n.status);
            return (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className="flex items-center gap-2.5 rounded-qd-lg border p-2 text-left transition-colors"
                style={active
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-[13px] font-bold text-qd-on-accent" style={{ background: `radial-gradient(circle, ${col}, var(--qd-danger-deep))` }}>
                  {n.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-qd-display text-[14px] text-qd-ink-strong">{n.name}</span>
                  <span className="block truncate font-qd-mono text-[7.5px] text-qd-ink-muted">{subtitleOf(n)}</span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* DETAIL */}
        <div className="flex-1 overflow-auto p-6">
          {!selected ? (
            <p className="text-qd-ink-muted">Select a soul from the cast.</p>
          ) : (
            <>
              <div className="flex gap-5">
                <div className="grid h-[200px] w-[160px] flex-none place-items-center overflow-hidden rounded-qd-xl border border-qd-faint bg-[rgba(255,255,255,0.02)]">
                  {selected.imageUrl
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-cover" />
                    : <span className="font-qd-mono text-[9px] text-qd-ink-faintest">NPC art</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-qd-display text-[30px] leading-none text-qd-ink-strong">{selected.name}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(selected.tags ?? []).slice(0, 6).map((t) => (
                      <span key={t} className="rounded-full border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-qd-mono text-[9px] text-qd-ink-2">{t}</span>
                    ))}
                    {selected.status && (
                      <span className="rounded-full px-2.5 py-1 font-qd-mono text-[9px]" style={{ color: statusColor(selected.status), borderColor: statusColor(selected.status), borderWidth: 1, background: 'rgba(255,255,255,.03)' }}>{selected.status.toUpperCase()}</span>
                    )}
                  </div>
                  {selected.description && (
                    <p className="mt-3 max-w-[560px] text-qd-body leading-relaxed text-qd-ink-2">{selected.description}</p>
                  )}
                  <div className="mt-4 flex gap-2.5">
                    <button className="rounded-qd-md bg-qd-accent px-3.5 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">Push to scene ▸</button>
                    <button className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3.5 py-2 font-qd-display text-[13px] text-qd-ink-2">Add to combat</button>
                    <button className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3.5 py-2 font-qd-display text-[13px] text-qd-ink-2">Edit</button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3.5">
                <InfoCard label="Role & Manner">
                  {selected.personality?.traits?.length ? selected.personality.traits.join(' · ') : (selected.role || '—')}
                </InfoCard>
                {/* Appears In — surfaces location + faction as known haunts. No session
                    join exists on NPC; graceful empty state when both are absent. */}
                <InfoCard label="Appears In">
                  {(() => {
                    const tokens: string[] = [];
                    if (selected.location) tokens.push(selected.location);
                    if (selected.faction) tokens.push(selected.faction);
                    if (tokens.length === 0) {
                      return (
                        <span className="italic text-qd-ink-muted">
                          No known haunts yet — the world is still taking shape.
                        </span>
                      );
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {tokens.map((tok) => (
                          <span
                            key={tok}
                            className="rounded-qd-sm border border-qd-faint bg-[rgba(255,255,255,0.04)] px-2 py-1 font-qd-mono text-[9px] text-qd-ink-2"
                          >
                            {tok}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </InfoCard>
                <InfoCard label="Location">
                  {selected.location || '—'}
                </InfoCard>
                {isDM && (
                  <InfoCard label="Secret" secret>
                    {selected.secrets || 'No secret recorded.'}
                  </InfoCard>
                )}
                <InfoCard label="Motivation">
                  {selected.motivation || '—'}
                </InfoCard>
                {isDM && (
                  <InfoCard label="Relationships">
                    {relsQ.isLoading || brainNpcsQ.isLoading ? (
                      <span className="text-qd-ink-muted">Tracing the ties…</span>
                    ) : relations.length === 0 ? (
                      // Best-effort name match: no brain entity, or no ties recorded.
                      <span className="text-qd-ink-muted">No known ties.</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {relations.map((r) => (
                          <div key={r.id} className="flex items-baseline gap-2">
                            <span className="text-qd-ink-strong">{r.otherName}</span>
                            <span className="font-qd-mono text-[8px] uppercase tracking-[0.1em] text-qd-ink-muted">{r.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
