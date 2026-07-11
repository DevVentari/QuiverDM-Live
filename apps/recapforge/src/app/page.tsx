'use client';

import Link from 'next/link';
import { Masthead } from '@/components/manuscript/Masthead';

// ---- Stage-bar palette --------------------------------------------------
const STAGE = { done: '#221d16', live: '#a33b2a', todo: '#d8cfba' };
const stagesFor = (idx: number) =>
  [0, 1, 2, 3, 4, 5].map((i) => (i < idx ? STAGE.done : i === idx ? STAGE.live : STAGE.todo));

type LedgerEntry = {
  n: string;
  title: string;
  voice: string;
  standing: string;
  idx: number;
  stColor: string;
  date: string;
  action: string;
  href: string;
};

const LEDGER: LedgerEntry[] = [
  { n: '07', title: 'The Withering Weeks', voice: 'the scribe listens — 67% set down', standing: 'transcribing', idx: 1, stColor: '#a33b2a', date: 'Nov 2', action: '', href: '/upload' },
  { n: '06', title: 'Ashes of Concordia', voice: 'one voice still awaits its name', standing: 'name the voices', idx: 2, stColor: '#a33b2a', date: 'Oct 19', action: 'name →', href: '/upload' },
  { n: '05', title: 'The Starfall Conspiracy', voice: '3 editor’s marks await your answer', standing: 'in proof', idx: 3, stColor: '#a33b2a', date: 'Oct 5', action: 'proof →', href: '/proof' },
  { n: '04', title: 'Festival of Thin Veils', voice: 'the tale is told — ready to bind', standing: 'tale told', idx: 4, stColor: '#221d16', date: 'Sep 21', action: 'bind →', href: '/proof' },
  { n: '03', title: 'The Garden Dinner', voice: 'Chapter III — dinner among emperors', standing: 'bound', idx: 6, stColor: '#8a8070', date: 'Sep 7', action: 'read →', href: '/chronicle' },
  { n: '02', title: 'The Keep Appears', voice: 'Chapter II — a hearth that was waiting', standing: 'bound', idx: 6, stColor: '#8a8070', date: 'Aug 17', action: 'read →', href: '/chronicle' },
  { n: '01', title: 'Whispered Names', voice: 'Chapter I — a storm that knew their names', standing: 'bound', idx: 6, stColor: '#8a8070', date: 'Aug 3', action: 'read →', href: '/chronicle' },
];

export default function LedgerPage() {
  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 1080 }}>
        <div className="rf-page__caption">
          <span className="rf-page__badge">2a</span>
          <span className="rf-page__captiontext">The Manuscript — campaign home as the press ledger</span>
        </div>

        <div className="rf-paper">
          <Masthead
            right={
              <Link href="/upload" className="rf-btn rf-btn--solid" style={{ display: 'inline-flex', alignItems: 'center' }}>
                + New session
              </Link>
            }
          >
            <nav className="rf-masthead__nav">
              <span className="rf-masthead__link is-active">Ledger</span>
              <span className="rf-masthead__link">The book</span>
              <span className="rf-masthead__link">Workings</span>
            </nav>
          </Masthead>

          {/* title block */}
          <div className="rf-ledger__head">
            <div>
              <div className="rf-eyebrow">The chronicle of</div>
              <h1 className="rf-ledger__title">Tales from The Bonfire Keep</h1>
            </div>
            <div className="rf-ledger__stats">
              7 sessions set down
              <br />
              27 pages bound · 5 heroes
            </div>
          </div>

          {/* ledger table */}
          <div className="rf-ledger__table">
            <div className="rf-ledger__grid rf-ledger__cols">
              <span>No.</span>
              <span>Session</span>
              <span>Standing</span>
              <span>Recorded</span>
              <span style={{ textAlign: 'right' }} />
            </div>

            {LEDGER.map((L) => {
              const dotBg = L.idx >= 6 ? '#221d16' : '#a33b2a';
              return (
                <Link key={L.n} href={L.href} className="rf-ledger__grid rf-ledger__row">
                  <span className="rf-ledger__n">{L.n}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rf-ledger__sess-title">{L.title}</div>
                    <div className="rf-ledger__voice">{L.voice}</div>
                  </div>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="rf-ledger__dot" style={{ background: dotBg }} />
                      <span className="rf-ledger__standing" style={{ color: L.stColor }}>{L.standing}</span>
                    </div>
                    <div className="rf-ledger__stages">
                      {stagesFor(L.idx).map((bg, i) => (
                        <span key={i} className="rf-ledger__stage" style={{ background: bg }} />
                      ))}
                    </div>
                  </div>
                  <span className="rf-ledger__date">{L.date}</span>
                  <span className="rf-ledger__action">{L.action}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
