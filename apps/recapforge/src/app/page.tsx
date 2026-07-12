'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Masthead } from '@/components/manuscript/Masthead';

// ---- Stage-bar palette --------------------------------------------------
const STAGE = { done: '#221d16', live: '#a33b2a', todo: '#d8cfba' };
const stagesFor = (idx: number) =>
  [0, 1, 2, 3, 4, 5].map((i) => (i < idx ? STAGE.done : i === idx ? STAGE.live : STAGE.todo));

const STANDING_META: Record<string, { dot: string; color: string; stageIdx: number; action: string }> = {
  'awaiting delivery':     { dot: 'var(--rf-mark)', color: 'var(--rf-mark)', stageIdx: 0, action: 'deliver →' },
  'in the composing room': { dot: 'var(--rf-mark)', color: 'var(--rf-mark)', stageIdx: 1, action: 'compose →' },
  'transcribing':          { dot: 'var(--rf-mark)', color: 'var(--rf-mark)', stageIdx: 2, action: '' },
  'transcript ready':      { dot: 'var(--rf-ink)',  color: 'var(--rf-ink)',  stageIdx: 3, action: 'proof →' },
  'illegible':             { dot: 'var(--rf-mark)', color: 'var(--rf-mark)', stageIdx: 1, action: 'deliver again →' },
};

export default function LedgerPage() {
  const router = useRouter();
  const mine = trpc.forgeCampaign.mine.useQuery();
  const campaign = mine.data?.[0] ?? null;
  const sessions = trpc.forgeSessions.list.useQuery(
    { campaignId: campaign?.id ?? '' },
    { enabled: !!campaign },
  );
  const createSession = trpc.forgeSessions.create.useMutation();

  useEffect(() => {
    // Gate on !isFetching too: React Query serves a stale cached snapshot
    // synchronously on mount while a fresh fetch is in flight — redirecting
    // on that stale (possibly empty) snapshot would bounce a user who just
    // finished onboarding right back to /onboarding.
    if (mine.isSuccess && !mine.isFetching && mine.data.length === 0) router.replace('/onboarding');
  }, [mine.isSuccess, mine.isFetching, mine.data, router]);

  if (!campaign) return <main className="rf-page" />;

  const rows = sessions.data ?? [];

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 1080 }}>
        <div className="rf-paper">
          <Masthead
            right={
              <button
                className="rf-btn rf-btn--solid"
                disabled={createSession.isPending}
                onClick={async () => {
                  const s = await createSession.mutateAsync({ campaignId: campaign.id });
                  router.push(`/upload?campaign=${campaign.id}&session=${s.id}`);
                }}
              >
                + New session
              </button>
            }
          >
            <nav className="rf-masthead__nav">
              <span className="rf-masthead__link is-active">Ledger</span>
              <span className="rf-masthead__link">The book</span>
              <span className="rf-masthead__link">Workings</span>
            </nav>
          </Masthead>

          <div className="rf-ledger__head">
            <div>
              <div className="rf-eyebrow">The chronicle of</div>
              <h1 className="rf-ledger__title">{campaign.name}</h1>
            </div>
            <div className="rf-ledger__stats">
              {rows.length} session{rows.length === 1 ? '' : 's'} set down
            </div>
          </div>

          <div className="rf-ledger__table">
            <div className="rf-ledger__grid rf-ledger__cols">
              <span>No.</span><span>Session</span><span>Standing</span><span>Recorded</span>
              <span style={{ textAlign: 'right' }} />
            </div>

            {rows.length === 0 && (
              <div style={{ padding: '40px 0', fontStyle: 'italic', color: 'var(--rf-ink-muted)' }}>
                The ledger is empty. The chronicle awaits its first session.
              </div>
            )}

            {rows.map((s) => {
              const meta = STANDING_META[s.standing];
              return (
                <Link
                  key={s.id}
                  href={`/upload?campaign=${campaign.id}&session=${s.id}`}
                  className="rf-ledger__grid rf-ledger__row"
                >
                  <span className="rf-ledger__n">{String(s.sessionNumber).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rf-ledger__sess-title">{s.title ?? `Session ${s.sessionNumber}`}</div>
                    <div className="rf-ledger__voice">
                      {s.trackCount > 0 ? `${s.trackCount} voices delivered` : 'no recording delivered yet'}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="rf-ledger__dot" style={{ background: meta.dot }} />
                      <span className="rf-ledger__standing" style={{ color: meta.color }}>{s.standing}</span>
                    </div>
                    <div className="rf-ledger__stages">
                      {stagesFor(meta.stageIdx).map((bg, i) => (
                        <span key={i} className="rf-ledger__stage" style={{ background: bg }} />
                      ))}
                    </div>
                  </div>
                  <span className="rf-ledger__date">
                    {new Date(s.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="rf-ledger__action">{meta.action}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
