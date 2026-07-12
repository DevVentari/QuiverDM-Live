'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Masthead } from '@/components/manuscript/Masthead';

type Verdict = 'pending' | 'culled' | 'kept';

type Row = {
  ln: number;
  sp: string;
  narr?: boolean;
  id?: string; // present when the scribe flagged a line for the DM's ruling
  note?: string;
  text: string;
};

const ROWS: Row[] = [
  { ln: 611, sp: 'The DM', narr: true, text: 'The twin moons touch at last. Ten thousand held breaths in the amphitheater — and the Sacred Flame gutters like a candle in wind.' },
  { ln: 612, sp: 'Whisperwick', text: "I don't like how Draven's hand keeps drifting to that blade. I'm shadowing him through the crowd." },
  { ln: 613, sp: 'The DM', text: 'Make it an Insight check — the alignment is amplifying everything tonight.' },
  { ln: 614, sp: "Kah'Roak", id: 'c1', note: 'table-talk — pizza at the door. strike it?', text: "Hang on, pizza's at the door — two minutes, don't let anything stab anyone!" },
  { ln: 615, sp: 'Whisperwick', text: 'A 23. Wick sees the exact moment something else takes the wheel behind his eyes.' },
  { ln: 616, sp: 'The DM', narr: true, text: 'Marcus Draven moves with impossible speed. The void-touched blade rises over Emperor Aurelias—' },
  { ln: 617, sp: "Kah'Roak", text: "KAH'ROAK INTERCEPTS. Rage. If that blade lands, it lands on me." },
  { ln: 618, sp: 'Blam-Bam', id: 'c2', note: 'rules chatter — already struck.', text: 'wait, is damage doubled under the alignment?? this eclipse is BROKEN lol' },
  { ln: 619, sp: 'The DM', text: "It is. 31 slashing, 18 necrotic — and you age four years, Kah'Roak. Your beard silvers at the chin." },
  { ln: 620, sp: 'Oriyan', text: "The tear— it's speaking to me. It knows my chronicle. 'Thank you, little scribe, for such thorough documentation.'" },
  { ln: 621, sp: 'Oriyan', id: 'c3', note: 'the cat again. strike it?', text: 'brb the cat is literally sitting on my keyboard' },
  { ln: 622, sp: 'Blam-Bam', text: "Blam-Bam plants both feet, opens the aether-coil, and gives the Sacred Flame something to hold onto. 'Not today, friend.'" },
  { ln: 623, sp: 'The DM', narr: true, text: 'The Flame steadies. The tear shrieks, narrows — and closes to a scar in the sky. What is left of the ceremony is silence.' },
];

export default function GalleyProofPage() {
  // Initial marks: line 618 was already struck; two await the DM's ruling.
  const [culls, setCulls] = useState<Record<string, Verdict>>({ c1: 'pending', c2: 'culled', c3: 'pending' });
  const set = (id: string, v: Verdict) => setCulls((s) => ({ ...s, [id]: v }));
  const answered = Object.values(culls).filter((v) => v !== 'pending').length;

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 1180 }}>
        <div className="rf-page__caption">
          <span className="rf-page__badge">1a</span>
          <span className="rf-page__captiontext">The Manuscript — transcript review as a galley proof</span>
        </div>

        <div className="rf-paper">
          <Masthead
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span className="rf-masthead__meta">{answered} of 3 marks answered</span>
                <Link href="/chronicle" className="rf-btn rf-btn--solid" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Pass for press →
                </Link>
              </div>
            }
          >
            <Link href="/" className="rf-masthead__crumb">Tales from The Bonfire Keep · Galley — Session 05</Link>
          </Masthead>

          {/* title block */}
          <div className="rf-galley__titleblock">
            <div className="rf-eyebrow">Session the Fifth · October 5 · 2 h 58 m</div>
            <h1 className="rf-galley__title">The Starfall Conspiracy</h1>
            <div className="rf-galley__hr" />
            <div className="rf-galley__byline">as spoken at the table, set down by the scribe</div>
          </div>

          {/* galley body: line-numbered proof + margin notes */}
          <div className="rf-galley__body">
            {ROWS.map((r) => {
              const cull = r.id ? culls[r.id] : null;
              const struck = cull === 'culled';
              const pending = cull === 'pending';
              return (
                <div key={r.ln} style={{ display: 'contents' }}>
                  <div className="rf-galley__lineno">{r.ln}</div>

                  <div className="rf-galley__line" style={{ background: pending ? 'rgba(163,59,42,.05)' : 'transparent' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <span className="rf-galley__speaker" style={{ color: r.narr ? 'var(--rf-accent)' : 'var(--rf-ink-2)' }}>
                        {r.sp}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="rf-galley__text"
                          style={{
                            fontStyle: r.narr ? 'italic' : 'normal',
                            color: struck ? 'var(--rf-ink-faint)' : 'var(--rf-ink)',
                            textDecoration: struck ? 'line-through' : 'none',
                          }}
                        >
                          {r.text}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rf-galley__margin">
                    {r.id && (
                      <div className="rf-galley__note-wrap">
                        <div className="rf-galley__note">{r.note}</div>

                        {pending && (
                          <div className="rf-galley__note-actions">
                            <button className="rf-btn rf-btn--mark" onClick={() => set(r.id!, 'culled')}>Strike it</button>
                            <button className="rf-btn rf-btn--stet" onClick={() => set(r.id!, 'kept')}>Stet</button>
                          </div>
                        )}

                        {(cull === 'culled' || cull === 'kept') && (
                          <div className="rf-galley__verdict-row">
                            <span className="rf-galley__verdict">
                              {struck ? 'struck from the record' : 'stet — it stands'}
                            </span>
                            <button className="rf-galley__undo" onClick={() => set(r.id!, 'pending')}>undo</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rf-folio">
            <span>Galley proof — not for the players’ eyes</span>
            <span>fol. 41</span>
          </div>
        </div>
      </div>
    </main>
  );
}
