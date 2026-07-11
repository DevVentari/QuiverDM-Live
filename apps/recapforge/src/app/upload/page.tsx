'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Masthead } from '@/components/manuscript/Masthead';

type TrackState = 'done' | 'arriving' | 'error';
type Track = { file: string; size: string; assign: string | null; state: TrackState; pct?: number };

const CANDIDATES = ['The Beast of Snarlswood', 'Oriyan Vale'];

export default function ComposingRoomPage() {
  // The fifth track arrives nameless — the DM must give it a voice before type is set.
  const [track5, setTrack5] = useState<string | null>(null);

  const tracks: Track[] = useMemo(
    () => [
      { file: 'craig-01-alex_dm.flac', size: '412 MB', assign: 'Alex — the DM', state: 'done' },
      { file: 'craig-02-jules.flac', size: '388 MB', assign: 'Blam-Bam Bigglesworth', state: 'done' },
      { file: 'craig-03-dana.flac', size: '371 MB', assign: "Kah'Roak", state: 'done' },
      { file: 'craig-04-priya.flac', size: '402 MB', assign: 'Whisperwick Quickclaw', state: 'arriving', pct: 62 },
      { file: 'craig-05-theo.flac', size: '365 MB', assign: track5, state: 'done' },
      { file: 'craig-06-sam.flac', size: '—', assign: null, state: 'error' },
    ],
    [track5],
  );

  const received = tracks.filter((t) => t.state === 'done').length;
  const ready = !!track5;
  const unpicked = CANDIDATES.filter((n) => n !== track5);

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 880 }}>
        <div className="rf-page__caption">
          <span className="rf-page__badge">2b</span>
          <span className="rf-page__captiontext">The Manuscript — upload as the composing room</span>
        </div>

        <div className="rf-paper">
          <Masthead right={<span className="rf-masthead__meta">{received} of 6 tracks received</span>}>
            <Link href="/" className="rf-masthead__crumb">Ledger → Session 08 · new</Link>
          </Masthead>

          <div className="rf-compose__body">
            <h1 className="rf-compose__title">Deliver the recording</h1>
            <div className="rf-compose__sub">One Craig track per voice. Each must bear a name before the scribe begins.</div>

            <div className="rf-dropzone" role="button" tabIndex={0}>
              <div className="rf-dropzone__lead">Drop the tracks here</div>
              <div className="rf-dropzone__hint">FLAC or WAV — the composing room keeps them in order</div>
            </div>

            {/* track ledger */}
            <div className="rf-track__cols">
              <span />
              <span>Track</span>
              <span>Voice</span>
              <span style={{ textAlign: 'right' }}>Size</span>
            </div>

            {tracks.map((t) => {
              const err = t.state === 'error';
              const needsName = !t.assign && !err;
              const mark = err ? '✕' : t.state === 'arriving' ? '…' : '✓';
              const markColor = err ? 'var(--rf-mark)' : t.state === 'arriving' ? 'var(--rf-ink-muted)' : 'var(--rf-ink)';
              const rowBg = err ? 'rgba(163,59,42,.05)' : needsName ? 'rgba(122,46,33,.04)' : 'transparent';
              const note = err ? 'illegible — offer it again' : t.state === 'arriving' ? `arriving, ${t.pct}%` : 'received';
              const noteColor = err ? 'var(--rf-mark)' : 'var(--rf-ink-faint)';

              return (
                <div key={t.file} className="rf-track__row" style={{ background: rowBg }}>
                  <span className="rf-track__mark" style={{ color: markColor }}>{mark}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rf-track__file">{t.file}</div>
                    <div className="rf-track__note" style={{ color: noteColor }}>{note}</div>
                  </div>
                  <div className="rf-track__assign-cell">
                    {t.assign ? (
                      <span className="rf-track__assign">{t.assign}</span>
                    ) : needsName ? (
                      <div className="rf-track__choices">
                        {unpicked.map((name) => (
                          <button key={name} className="rf-btn rf-btn--ghost" onClick={() => setTrack5(name)}>
                            {name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="rf-track__size">{t.size}</span>
                </div>
              );
            })}

            <div className="rf-compose__foot">
              <span className="rf-compose__setnote" style={{ color: ready ? 'var(--rf-ink)' : 'var(--rf-mark)' }}>
                {ready ? 'Six voices, six names. The scribe may begin.' : 'Every voice must bear a name before type is set.'}
              </span>
              {ready ? (
                <Link href="/proof" className="rf-btn rf-btn--solid" style={{ padding: '11px 22px', display: 'inline-flex', alignItems: 'center' }}>
                  Set the type →
                </Link>
              ) : (
                <button className="rf-btn rf-btn--solid" style={{ padding: '11px 22px' }} disabled>
                  Set the type →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
