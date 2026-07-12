'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = (n: number) => ROMAN[n] ?? String(n);

function Chronicle() {
  const params = useSearchParams();
  const campaignId = params.get('campaign') ?? '';
  const sessionId = params.get('session') ?? '';

  const mine = trpc.forgeCampaign.mine.useQuery();
  const campaign = mine.data?.find((c) => c.id === campaignId) ?? null;
  const sess = trpc.forgeSessions.getOne.useQuery({ campaignId, sessionId }, { enabled: !!campaignId && !!sessionId });
  const galley = trpc.forgeTranscript.get.useQuery({ campaignId, sessionId }, { enabled: !!campaignId && !!sessionId });

  if (!galley.data) {
    return (
      <main className="rf-page">
        <div className="rf-page__inner" style={{ maxWidth: 920 }}>
          <div className="rf-paper rf-paper--warm" style={{ padding: '64px', textAlign: 'center', fontStyle: 'italic', color: 'var(--rf-ink-muted)' }}>
            {galley.isLoading ? 'the pages are being bound…' : 'No chronicle has been set down for this session yet.'}
          </div>
        </div>
      </main>
    );
  }

  // The reviewed dialogue: struck table-talk removed, character names kept.
  const struck = new Set(galley.data.oocMarks.filter((m) => m.verdict === 'strike').map((m) => m.index));
  const lines = galley.data.lines.filter((ln) => !struck.has(ln.index));
  const sessionNumber = sess.data?.sessionNumber ?? 1;
  const title = sess.data?.title ?? sess.data?.suggestedTitle ?? `Session ${sessionNumber}`;
  const chapter = sess.data?.suggestedChapter ?? sessionNumber;

  // A speaker changes → a fresh paragraph; consecutive same-speaker lines join.
  const blocks: { speaker: string; text: string }[] = [];
  for (const ln of lines) {
    const last = blocks[blocks.length - 1];
    if (last && last.speaker === ln.speaker) last.text += ` ${ln.text}`;
    else blocks.push({ speaker: ln.speaker, text: ln.text });
  }

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 920 }}>
        <div className="rf-paper rf-paper--warm">
          <div className="rf-bound__runhead">
            <span>{campaign?.name ?? 'The chronicle'}</span>
            <span>Session {roman(sessionNumber)}</span>
          </div>

          <div className="rf-bound__body">
            <div style={{ textAlign: 'center' }}>
              <div className="rf-bound__chapter">Chapter {roman(chapter)}</div>
              <h1 className="rf-bound__title">{title}</h1>
              <div className="rf-bound__dateline">
                <span className="rf-tick" />
                <span className="rf-date">{sess.data?.suggestedVoice ?? 'told in the players’ own voices'}</span>
                <span className="rf-tick" />
              </div>
            </div>

            {/* the chronicle, as spoken — reviewed dialogue in the bound hand */}
            <div style={{ marginTop: 44 }}>
              {blocks.length === 0 && (
                <div style={{ fontStyle: 'italic', color: 'var(--rf-ink-muted)', textAlign: 'center' }}>
                  Every line was struck — the record is silent.
                </div>
              )}
              {blocks.map((b, i) => (
                <div key={i} className="rf-bound__para" style={{ marginTop: i === 0 ? 0 : 20 }}>
                  <span style={{ fontFamily: 'var(--rf-font-mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--rf-accent)', display: 'block', marginBottom: 4 }}>
                    {b.speaker}
                  </span>
                  {b.text}
                </div>
              ))}
            </div>

            <div className="rf-bound__nav" style={{ marginTop: 60 }}>
              <Link href={`/?campaign=${campaignId}`}>← back to the ledger</Link>
              <Link href={`/proof?campaign=${campaignId}&session=${sessionId}`}>reopen the galley →</Link>
            </div>
          </div>

          <div className="rf-bound__pagefol">· the chronicle stands ·</div>
        </div>
      </div>
    </main>
  );
}

export default function ChroniclePage() {
  return (
    <Suspense fallback={<main className="rf-page" />}>
      <Chronicle />
    </Suspense>
  );
}
