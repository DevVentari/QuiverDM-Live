'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

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

  const rows = (npcs.data as NpcRow[] | undefined) ?? [];
  const filtered = useMemo(
    () => rows.filter((n) => n.name.toLowerCase().includes(search.trim().toLowerCase())),
    [rows, search],
  );
  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

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
                  <span className="block truncate text-sm text-qd-ink-strong">{n.name}</span>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
