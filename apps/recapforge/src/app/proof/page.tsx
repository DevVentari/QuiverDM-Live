'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Masthead } from '@/components/manuscript/Masthead';

function ProofScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get('campaign') ?? '';
  const sessionId = params.get('session') ?? '';
  const passForPress = trpc.forgeSessions.passForPress.useMutation();

  const progress = trpc.forgeSessions.scribeProgress.useQuery(
    { campaignId, sessionId },
    {
      enabled: !!campaignId && !!sessionId,
      refetchInterval: (q) => {
        const d = q.state.data;
        return d && (d.overall === 'complete' || d.overall === 'illegible') ? false : 4000;
      },
    },
  );

  const complete = progress.data?.overall === 'complete';
  const galley = trpc.forgeTranscript.get.useQuery(
    { campaignId, sessionId },
    { enabled: complete },
  );

  const utils = trpc.useUtils();
  const resolve = trpc.forgeTranscript.resolveOoc.useMutation({
    onSuccess: () => utils.forgeTranscript.get.invalidate({ campaignId, sessionId }),
  });

  const sess = trpc.forgeSessions.getOne.useQuery({ campaignId, sessionId }, { enabled: complete });
  const applyTitle = trpc.forgeSessions.applyTitle.useMutation({ onSuccess: () => sess.refetch() });
  const shownTitle = sess.data?.title ?? sess.data?.suggestedTitle ?? 'The galley proof';

  const keyByChar = new Map(
    (progress.data?.voices ?? []).map((v) => [v.characterName ?? v.speakerLabel, v.key]),
  );

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 1180 }}>
        <div className="rf-paper">
          <Masthead
            right={
              complete ? (
                <button
                  className="rf-btn rf-btn--solid"
                  disabled={passForPress.isPending}
                  onClick={async () => {
                    await passForPress.mutateAsync({ campaignId, sessionId });
                    router.push(`/?campaign=${campaignId}`);
                  }}
                >
                  {passForPress.isPending ? 'Passing…' : 'Pass for press →'}
                </button>
              ) : (
                <span className="rf-masthead__meta">
                  {progress.data ? `${progress.data.done} of ${progress.data.total} voices set down` : 'the scribe stirs…'}
                </span>
              )
            }
          >
            <Link href={`/?campaign=${campaignId}`} className="rf-masthead__crumb">Ledger → the galley</Link>
          </Masthead>

          {!complete && (
            <div className="rf-galley__titleblock">
              <div className="rf-eyebrow rf-eyebrow--accent">The scribe at work</div>
              <h1 className="rf-galley__title">Setting down the voices</h1>
              <div className="rf-galley__hr" />
              <div className="rf-galley__byline">
                {progress.data?.overall === 'illegible'
                  ? 'the scribe could not make out every voice — deliver them again'
                  : 'each voice set to the page as the scribe hears it'}
              </div>
            </div>
          )}

          {/* SCRIBE AT WORK — voice-by-voice reveal */}
          {!complete && (
            <div style={{ padding: '24px 46px 60px', maxWidth: 900, margin: '0 auto' }}>
              {(progress.data?.voices ?? []).map((v) => {
                const label = v.characterName ?? v.speakerLabel;
                const statusText =
                  v.status === 'done' ? 'set down'
                  : v.status === 'transcribing' ? 'the scribe is listening…'
                  : v.status === 'error' ? 'illegible — the scribe could not make it out'
                  : 'queued';
                const statusColor = v.status === 'done' ? 'var(--rf-ink)' : v.status === 'error' ? 'var(--rf-mark)' : 'var(--rf-ink-muted)';
                return (
                  <div key={v.recordingId} style={{ padding: '18px 0', borderBottom: '1px dotted var(--rf-rule-dot)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                      <span style={{ fontSize: 18, fontWeight: 600 }}>{label}</span>
                      <span className="rf-galley__speaker" style={{ color: statusColor, width: 'auto' }}>{statusText}</span>
                    </div>
                    {v.text && (
                      <div className="rf-galley__text" style={{ marginTop: 8, color: 'var(--rf-ink-2)' }}>
                        {v.text.length > 600 ? v.text.slice(0, 600) + '…' : v.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* GALLEY — read-only lines (Task 10 adds strike/stet) */}
          {complete && galley.data && (
            <>
              <div className="rf-galley__titleblock">
                <div className="rf-eyebrow">{sess.data?.suggestedChapter ? `Chapter ${sess.data.suggestedChapter}` : 'The chronicle, as spoken'}</div>
                <h1 className="rf-galley__title">{shownTitle}</h1>
                <div className="rf-galley__hr" />
                <div className="rf-galley__byline">{sess.data?.suggestedVoice ?? 'set down by the scribe · pass for press when it reads true'}</div>
                {sess.data && !sess.data.title && sess.data.suggestedTitle && (
                  <button
                    className="rf-btn rf-btn--ghost"
                    style={{ marginTop: 12 }}
                    onClick={() => applyTitle.mutate({
                      campaignId,
                      sessionId,
                      title: sess.data!.suggestedTitle!,
                      voice: sess.data!.suggestedVoice ?? undefined,
                      chapter: sess.data!.suggestedChapter ?? undefined,
                    })}
                  >
                    Accept this title
                  </button>
                )}
              </div>
              <div style={{ padding: '24px 46px 40px', maxWidth: 900, margin: '0 auto' }}>
                {galley.data.lines.map((ln) => {
                  const mark = galley.data!.oocMarks.find((m) => m.index === ln.index);
                  const struck = mark?.verdict === 'strike';
                  return (
                    <div key={ln.index} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '8px 0' }}>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <button
                          className="rf-galley__undo"
                          title="hear this voice"
                          onClick={() => {
                            const key = keyByChar.get(ln.speaker);
                            if (!key) return;
                            const audio = new Audio(`/api/uploads/track?key=${encodeURIComponent(key)}`);
                            audio.currentTime = Math.max(0, ln.start / 1000 - 2);
                            void audio.play();
                          }}
                        >▸</button>
                        <span className="rf-galley__speaker">{ln.speaker}</span>
                        <span className="rf-galley__text" style={{ flex: 1, textDecoration: struck ? 'line-through' : 'none', color: struck ? 'var(--rf-ink-faint)' : 'var(--rf-ink)' }}>{ln.text}</span>
                      </div>
                      <div>
                        {mark && (
                          <div className="rf-galley__note-wrap">
                            <div className="rf-galley__note">{mark.reason}</div>
                            {!mark.verdict ? (
                              <div className="rf-galley__note-actions">
                                <button className="rf-btn rf-btn--mark" onClick={() => resolve.mutate({ campaignId, transcriptId: galley.data!.transcriptId, index: ln.index, verdict: 'strike' })}>Strike it</button>
                                <button className="rf-btn rf-btn--stet" onClick={() => resolve.mutate({ campaignId, transcriptId: galley.data!.transcriptId, index: ln.index, verdict: 'stet' })}>Stet</button>
                              </div>
                            ) : (
                              <div className="rf-galley__verdict">{struck ? 'struck from the record' : 'stet — it stands'}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rf-folio"><span>Galley proof — not for the players’ eyes</span><span>fol. 1</span></div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={<main className="rf-page" />}>
      <ProofScreen />
    </Suspense>
  );
}
