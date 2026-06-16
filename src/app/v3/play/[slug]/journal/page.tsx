'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

// Player-facing session row from play.getCampaignHub().sessions
interface SessionRow {
  id: string;
  title: string | null;
  status: string | null;
  date: string | Date | null;
  aiSummary: string | null;
  playerVisibility: string | null;
  sessionNumber: number | null;
}

// play.getSharedNpcs() row shape
interface SharedNpc {
  id: string;
  name: string;
  description: string | null;
  faction: string | null;
  role: string | null;
  imageUrl: string | null;
}

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const subtitleOf = (n: SharedNpc) =>
  (n.role || n.faction || 'KNOWN').toUpperCase();

export default function PlayerJournalPage() {
  const { slug } = useParams() as { slug: string };

  const hub = trpc.play.getCampaignHub.useQuery({ slug }, { staleTime: 60_000 });
  const campaignId = (hub.data?.id as string | undefined) ?? '';

  const sessions = useMemo<SessionRow[]>(
    () => ((hub.data?.sessions as SessionRow[] | undefined) ?? []),
    [hub.data],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && sessions.length) setSelectedId(sessions[0].id);
  }, [sessions, selectedId]);

  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0] ?? null;

  // Full recap for the selected session (richer than the list summary).
  const recap = trpc.play.getSessionRecap.useQuery(
    { sessionId: selected?.id ?? '' },
    { enabled: !!selected?.id, staleTime: 60_000 },
  );

  const sharedNpcs = trpc.play.getSharedNpcs.useQuery(
    { campaignId },
    { enabled: !!campaignId, staleTime: 60_000 },
  );
  const npcs = (sharedNpcs.data as SharedNpc[] | undefined) ?? [];

  // Player notes — no mutation exists yet for personal journal notes.
  const [notes, setNotes] = useState('');
  const saveNotes = () => {
    // TODO: persist player journal notes once a play.updateJournalNotes mutation exists.
  };

  if (hub.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Turning the pages…</div>;
  }
  if (hub.error) {
    return (
      <div className="px-8 py-16 text-qd-ink-muted">
        The chronicle resists your touch. Try again.
      </div>
    );
  }
  if (!sessions.length) {
    return (
      <div className="px-8 py-16 text-qd-ink-muted">Your chronicle is yet unwritten.</div>
    );
  }

  const campaignName = (hub.data?.name as string | undefined) ?? 'Your chronicle';
  const recapText = recap.data?.aiSummary ?? selected?.aiSummary ?? null;

  return (
    <div className="mx-auto flex h-full max-w-[1100px] flex-col px-6 py-6 md:px-8">
      {/* header */}
      <header className="mb-5 border-b border-qd-faint pb-4">
        <div className="font-qd-mono text-[9px] uppercase tracking-[0.2em] text-qd-accent-text">
          Your journal
        </div>
        <h1 className="mt-1 font-qd-display text-3xl leading-none text-qd-ink-strong">
          {campaignName}
        </h1>
        <div className="mt-2 font-qd-mono text-[10px] uppercase tracking-[0.08em] text-qd-ink-muted">
          {sessions.length} {sessions.length === 1 ? 'chapter' : 'chapters'} remembered
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 md:flex-row">
        {/* TIMELINE of sessions */}
        <aside className="flex w-full flex-none flex-col gap-2.5 overflow-auto md:w-[300px]">
          <div className="mb-1 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
            The chronicle
          </div>
          {sessions.map((s) => {
            const active = selected?.id === s.id;
            const n = s.sessionNumber;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="flex items-start gap-3 rounded-qd-lg border p-3 text-left transition-colors"
                style={
                  active
                    ? {
                        background:
                          'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))',
                        borderColor: 'var(--qd-border-accent)',
                      }
                    : {
                        background: 'rgba(255,255,255,.02)',
                        borderColor: 'var(--qd-border-faint)',
                      }
                }
              >
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-full font-qd-mono text-[12px] font-bold text-qd-on-accent"
                  style={{ background: 'radial-gradient(circle, var(--qd-accent), var(--qd-danger-deep))' }}
                >
                  {n != null ? n : '·'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-qd-ink-strong">
                    {s.title || 'Untitled session'}
                  </span>
                  <span className="mt-0.5 block font-qd-mono text-[8px] uppercase tracking-[0.06em] text-qd-ink-muted">
                    {fmtDate(s.date)}
                    {s.aiSummary ? '' : ' · awaiting recap'}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* SELECTED RECAP */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto">
          {!selected ? (
            <p className="text-qd-ink-muted">Choose a chapter to relive it.</p>
          ) : (
            <>
              <section className="rounded-qd-xl border border-qd-faint bg-[rgba(255,255,255,0.02)] p-5">
                <div className="flex items-baseline gap-3">
                  {selected.sessionNumber != null && (
                    <span className="font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-accent-text">
                      Chapter {selected.sessionNumber}
                    </span>
                  )}
                  <span className="font-qd-mono text-[10px] uppercase tracking-[0.08em] text-qd-ink-muted">
                    {fmtDate(selected.date)}
                  </span>
                </div>
                <h2 className="mt-2 font-qd-display text-2xl leading-tight text-qd-ink-strong">
                  {selected.title || 'Untitled session'}
                </h2>

                <div className="mt-4 text-qd-body leading-relaxed text-qd-ink-2">
                  {recap.isLoading ? (
                    <span className="text-qd-ink-muted">Turning the pages…</span>
                  ) : recap.error ? (
                    <span className="text-qd-ink-muted">This memory is clouded.</span>
                  ) : recapText ? (
                    recapText.split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="mb-3 last:mb-0">
                        {para}
                      </p>
                    ))
                  ) : (
                    <span className="italic text-qd-ink-muted">
                      No recap has been recorded for this chapter yet.
                    </span>
                  )}
                </div>
              </section>

              {/* Player notes (personal marginalia) */}
              <section className="rounded-qd-xl border border-qd-faint bg-[rgba(255,255,255,0.02)] p-5">
                <div className="mb-2 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
                  Your marginalia
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Scribble what you remember, what you suspect…"
                  rows={4}
                  className="w-full resize-none rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-qd-body-sm text-qd-ink-2 placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={saveNotes}
                    className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3.5 py-2 font-qd-display text-[13px] text-qd-ink-2"
                  >
                    Inscribe
                  </button>
                </div>
              </section>

              {/* People you know */}
              <section>
                <div className="mb-2.5 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
                  People you know · {npcs.length}
                </div>
                {sharedNpcs.isLoading ? (
                  <p className="text-qd-body-sm text-qd-ink-muted">Recalling faces…</p>
                ) : npcs.length === 0 ? (
                  <p className="text-qd-body-sm text-qd-ink-muted">
                    You have met no one worth remembering — yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {npcs.map((n) => (
                      <div
                        key={n.id}
                        className="flex flex-col items-center rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] p-3 text-center"
                      >
                        {n.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={n.imageUrl}
                            alt={n.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="grid h-10 w-10 place-items-center rounded-full font-qd-mono text-[15px] font-bold text-qd-on-accent"
                            style={{ background: 'radial-gradient(circle, var(--qd-accent), var(--qd-danger-deep))' }}
                          >
                            {n.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="mt-2 truncate text-sm text-qd-ink-strong">{n.name}</div>
                        <div className="mt-0.5 truncate font-qd-mono text-[7px] uppercase tracking-[0.06em] text-qd-ink-muted">
                          {subtitleOf(n)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
