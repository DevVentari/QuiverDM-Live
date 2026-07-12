import Link from 'next/link';

const RECORD = [
  { t: '0:12', text: 'An imperial summons delivers the party to Concordia Stellaris, seven days before the alignment.' },
  { t: '0:58', text: "Seated at the Emperor's table: High Sage Lyria, Captain Draven, and a visiting delegation of the Verdant Compact." },
  { t: '1:24', text: "Draven's hand trembles near the void-touched blade — marked three times by Whisperwick." },
  { t: '2:10', text: 'Aurelias questions Oriyan about his chronicles; the mirror-shard runs cold.' },
  { t: '2:47', text: 'Lyria speaks of "containment failures" and a binding circle beneath the amphitheater.' },
];

const PERSONAE = [
  { name: 'Emperor Aurelias', role: 'the host' },
  { name: 'Capt. Marcus Draven', role: 'the trembling hand' },
  { name: 'High Sage Lyria', role: 'keeper of bindings' },
  { name: 'Oriyan Vale', role: 'the chronicler' },
  { name: 'Whisperwick Quickclaw', role: 'counting exits' },
  { name: 'The Beast of Snarlswood', role: 'smelling the rot' },
];

export default function ChroniclePage() {
  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 920 }}>
        <div className="rf-page__caption">
          <span className="rf-page__badge">1b</span>
          <span className="rf-page__captiontext">The Manuscript — published wiki session page, the bound book</span>
        </div>

        <div className="rf-paper rf-paper--warm">
          {/* running header */}
          <div className="rf-bound__runhead">
            <span>Tales from The Bonfire Keep</span>
            <span>Session III</span>
          </div>

          <div className="rf-bound__body">
            <div style={{ textAlign: 'center' }}>
              <div className="rf-bound__chapter">Chapter Three</div>
              <h1 className="rf-bound__title">The Garden Dinner</h1>
              <div className="rf-bound__dateline">
                <span className="rf-tick" />
                <span className="rf-date">September the 7th · told in the players’ own voices</span>
                <span className="rf-tick" />
              </div>
            </div>

            {/* drop-cap recap */}
            <div className="rf-bound__lede">
              <span className="rf-bound__dropcap">T</span>he summons arrived under the imperial seal, and by dusk the five
              stood in Thymal's Gardens — where the flowers bloomed desperately bright, as if they knew. At the Emperor's
              table sat sages, captains, and a chronicler's worst fear: a host who had read his work.{' '}
              <Link href="/chronicle" className="rf-wikilink">Oriyan Vale</Link> felt the mirror-shard go cold against his
              ribs when Aurelias leaned close.
            </div>

            <div className="rf-bound__pull">
              <div className="rf-bound__pull-quote">
                “Your reputation as a chronicler precedes you. I wonder — have you ever documented something you wish you
                hadn't?”
              </div>
              <div className="rf-bound__pull-attr">— Emperor Aurelias, over the third course</div>
            </div>

            <div className="rf-bound__para">
              Through the long dinner, <Link href="/chronicle" className="rf-wikilink">Whisperwick</Link> counted exits and{' '}
              <Link href="/chronicle" className="rf-wikilink">Captain Draven's</Link> hand trembled — three times, always
              near the void-touched blade. The Beast smelled rot beneath the perfume of the gardens. And when the plates
              were cleared, High Sage Lyria spoke quietly of a chamber beneath the amphitheater, and of bindings that do
              not hold forever.
            </div>

            {/* the record */}
            <div className="rf-bound__section">
              <div className="rf-section-rule">
                <span>The record</span>
                <span className="rf-rule-line" />
              </div>
              <div className="rf-bound__record">
                {RECORD.map((r) => (
                  <div key={r.t} className="rf-bound__record-row">
                    <span className="rf-bound__record-t">{r.t}</span>
                    <span className="rf-bound__record-text">{r.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* dramatis personae */}
            <div className="rf-bound__section">
              <div className="rf-section-rule">
                <span>Dramatis personae</span>
                <span className="rf-rule-line" />
              </div>
              <div className="rf-bound__personae">
                {PERSONAE.map((p) => (
                  <div key={p.name} className="rf-bound__persona">
                    <span className="rf-bound__persona-name">
                      <Link href="/chronicle" className="rf-wikilink">{p.name}</Link>
                    </span>
                    <span className="rf-bound__persona-role">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* footer nav */}
            <div className="rf-bound__nav">
              <Link href="/chronicle">← II. The Keep Appears</Link>
              <Link href="/chronicle">IV. Festival of Thin Veils →</Link>
            </div>
          </div>

          <div className="rf-bound__pagefol">· 27 ·</div>
        </div>
      </div>
    </main>
  );
}
