'use client';

/**
 * v3 Sessions — Session Flow run sheet, rebuilt from
 * docs/assets/designs/v3/designs/Session Flow HiFi.dc.html on the --qd-* token
 * system. Three columns: tonight's beats rail · current beat (read-aloud,
 * tools, if/then) · live session tools (timer, party, next beat). Heartflame's
 * "In the Margins" companion voice copy is preserved as the design has it.
 * Mock content held in arrays so it wires to a real session later.
 */

import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

type BeatState = 'done' | 'now' | 'combat' | 'planned';

interface Beat {
  name: string;
  meta: string;
  state: BeatState;
  badge: string; // glyph or number for the leading marker
}

const BEATS: Beat[] = [
  { name: 'Recap & cold open', meta: 'done · 12 min', state: 'done', badge: '✓' },
  { name: 'Festival arrival', meta: 'done · 28 min', state: 'done', badge: '✓' },
  { name: "Draven's betrayal", meta: 'NOW · the blade is drawn', state: 'now', badge: '▸' },
  { name: 'Amphitheater combat', meta: 'next · battle map ready', state: 'combat', badge: '⚔' },
  { name: 'Aftermath & the shard', meta: 'planned', state: 'planned', badge: '5' },
];

const TOOLS = [
  { label: 'Push Theatre scene ▸', bold: 600, bg: 'rgba(217,138,61,.14)', border: 'rgba(217,138,61,.45)', color: 'var(--qd-accent-text)' },
  { label: 'Reveal: Duskfall Blade', bold: 400, bg: 'rgba(176,143,208,.12)', border: 'rgba(176,143,208,.4)', color: 'var(--qd-arcane-bright)' },
  { label: '♪ Cue: Betrayal', bold: 400, bg: 'rgba(95,143,69,.12)', border: 'rgba(95,143,69,.4)', color: 'var(--qd-success-hi)' },
  { label: '⚔ Start combat ▸', bold: 700, bg: 'rgba(196,69,58,.16)', border: 'rgba(196,69,58,.5)', color: 'var(--qd-danger-hi)' },
];

const PARTY = [
  { name: 'Skreek', hp: '30/30', dot: 'var(--qd-success-bright)' },
  { name: 'Oriyen', hp: '38/38', dot: 'var(--qd-success-bright)' },
  { name: 'Norm', hp: '41/41', dot: '#c79a6a' },
];

function BeatRow({ beat }: { beat: Beat }) {
  const isDone = beat.state === 'done';
  const isNow = beat.state === 'now';

  const wrapStyle =
    isNow
      ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
      : isDone
        ? { background: 'rgba(95,143,69,.06)', borderColor: 'rgba(95,143,69,.3)' }
        : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border)' };

  let markerStyle: React.CSSProperties;
  let markerColor: string;
  if (isDone) {
    markerStyle = { background: 'rgba(95,143,69,.2)' };
    markerColor = 'var(--qd-success-bright)';
  } else if (isNow) {
    markerStyle = { background: 'var(--qd-accent)' };
    markerColor = 'var(--qd-on-accent)';
  } else if (beat.state === 'combat') {
    markerStyle = { border: '1px solid rgba(196,69,58,.5)' };
    markerColor = 'var(--qd-danger-hi)';
  } else {
    markerStyle = { border: '1px solid rgba(255,235,205,.2)' };
    markerColor = 'var(--qd-ink-muted)';
  }

  const titleColor = isDone ? 'var(--qd-success-hi)' : isNow ? '#f9efe0' : 'var(--qd-ink)';
  const metaColor = isDone ? '#7f8f6a' : isNow ? '#e09a6a' : 'var(--qd-ink-faint)';

  return (
    <div className="flex items-center gap-2.5 rounded-[11px] border px-[11px] py-[9px]" style={wrapStyle}>
      <span
        className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11px]"
        style={{ ...markerStyle, color: markerColor }}
      >
        {beat.badge === '✓' ? (
          <MaskedDndIcon name="util/tick" size={11} />
        ) : beat.badge === '⚔' ? (
          <MaskedDndIcon name="weapon/sword" size={11} />
        ) : (
          beat.badge
        )}
      </span>
      <div className="flex-1">
        <div className="text-[13px]" style={{ color: titleColor }}>{beat.name}</div>
        <div className={`${mono} text-[7.5px]`} style={{ color: metaColor }}>{beat.meta}</div>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Run sheet header */}
      <div
        className="flex items-center gap-3.5 border-b border-[var(--qd-border-faint)] px-[22px] py-3.5"
        style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.05),transparent)' }}
      >
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
          style={{ background: 'linear-gradient(150deg,var(--qd-accent-bright),var(--qd-accent-deeper))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--qd-on-accent)' }} />
        </span>
        <div>
          <div className="text-[18px] leading-none text-[var(--qd-ink-strong)]">Session 10 · Run Sheet</div>
          <div className={`${mono} mt-[3px] text-[9px] tracking-[0.08em] text-[var(--qd-ink-muted)]`}>THE FESTIVAL ASSASSINATION · beat by beat</div>
        </div>
        <div className="flex-1" />
        <span
          className={`${mono} flex items-center gap-[7px] rounded-[20px] border px-3 py-1.5 text-[9px]`}
          style={{ color: 'var(--qd-danger-hi)', background: 'rgba(196,69,58,.12)', borderColor: 'rgba(196,69,58,.4)' }}
        >
          <span className="v3-rec-blink h-[7px] w-[7px] rounded-full" style={{ background: 'var(--qd-danger)', boxShadow: '0 0 8px var(--qd-danger)' }} />
          REC · 1:24:08
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== BEATS ===== */}
        <aside className="flex w-[288px] flex-none flex-col gap-[7px] overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] px-3 py-3.5">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>TONIGHT&apos;S BEATS</div>
          {BEATS.map((b) => (
            <BeatRow key={b.name} beat={b} />
          ))}
          <div className="flex-1" />
          <button
            className={`${mono} cursor-pointer rounded-[10px] border border-dashed py-[9px] text-[10px]`}
            style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--qd-border-accent)', color: 'var(--qd-accent-bright)' }}
          >
            + Add a beat
          </button>
        </aside>

        {/* ===== CURRENT BEAT ===== */}
        <div className="flex-1 overflow-auto px-[26px] py-[22px]">
          <div className="flex items-center gap-2">
            <span className="v3-dot-pulse h-2 w-2 flex-none rounded-full" style={{ background: 'var(--qd-accent)', boxShadow: '0 0 10px var(--qd-accent)' }} />
            <span className={`${mono} text-[9px] tracking-[0.14em] text-[var(--qd-accent-bright)]`}>RUNNING NOW · BEAT 3 OF 5</span>
          </div>
          <div className="mt-[9px] text-[28px] text-[var(--qd-ink-strong)]">Draven&apos;s Betrayal</div>

          {/* read aloud */}
          <div className="mt-[18px] border-l-[3px] pl-4" style={{ borderColor: 'var(--qd-border-accent)' }}>
            <div className={`${mono} mb-[7px] text-[8px] tracking-[0.14em] text-[var(--qd-ink-muted)]`}>READ ALOUD</div>
            <div className="max-w-[620px] text-[17px] italic leading-[1.6] text-[var(--qd-ink-2)]">
              &quot;The music stops mid-note. Captain Draven steps from the honor guard, and steel slides free — a blade that weeps purple-red across the star-metal tiers.&quot;
            </div>
          </div>

          {/* beat tools */}
          <div className={`${mono} my-[22px] mb-[11px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>BEAT TOOLS</div>
          <div className="flex flex-wrap gap-[9px]">
            {TOOLS.map((t) => (
              <button
                key={t.label}
                className={`${display} cursor-pointer rounded-[10px] border px-3.5 py-2.5 text-[13px]`}
                style={{ background: t.bg, borderColor: t.border, color: t.color, fontWeight: t.bold }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* if / then */}
          <div className="mt-5 rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] px-[15px] py-3.5">
            <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>IF / THEN</div>
            <div className="text-[13.5px] leading-[1.6] text-[var(--qd-ink-2)]">
              • If the party tries to stop him → Draven goes first, initiative at +9.<br />
              • If they hesitate → the ambassador dies; renown drops, the tear widens.<br />
              • If Norm recognizes the face → Faeren&apos;s secret surfaces early.
            </div>
          </div>
        </div>

        {/* ===== TOOLS ===== */}
        <aside className="flex w-[268px] flex-none flex-col gap-3.5 overflow-auto border-l border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.16)] p-[18px]">
          <div className="rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] p-3.5 text-center">
            <div className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-ink-muted)]`}>SESSION TIME</div>
            <div className={`${display} mt-1.5 text-[30px] font-bold text-[var(--qd-accent-hi)]`}>1:24</div>
            <div className={`${mono} mt-0.5 text-[8px] text-[var(--qd-ink-faint)]`}>target 3:00 · on pace</div>
          </div>

          <button className={`${display} flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] p-3 text-[14px] text-[var(--qd-ink-2)]`}>
            <MaskedDndIcon name="dice/roll" size={15} /> Quick roll
          </button>
          <button className={`${display} cursor-pointer rounded-[11px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] p-3 text-[14px] text-[var(--qd-ink-2)]`}>
            🗒 Session note
          </button>

          <div className="flex-1 rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] p-[13px]">
            <div className={`${mono} text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>PARTY · live</div>
            <div className="mt-2.5 flex flex-col gap-2">
              {PARTY.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-[13px] text-[var(--qd-ink-2)]">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.dot }} />
                  {p.name}
                  <span className="flex-1" />
                  <span className={`${mono} text-[9px] text-[#7f8f6a]`}>{p.hp}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className={`${display} cursor-pointer rounded-[12px] border-none p-3.5 text-[15px] font-bold text-[var(--qd-on-accent)]`}
            style={{ background: 'linear-gradient(180deg,var(--qd-accent-bright),var(--qd-accent-deep))', boxShadow: '0 8px 20px rgba(217,138,61,.3)' }}
          >
            Next beat ▸
          </button>
        </aside>
      </div>
    </div>
  );
}
