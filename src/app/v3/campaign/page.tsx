'use client';

/**
 * v3 Campaign Overview — rebuilt from
 * docs/assets/designs/v3/designs/Campaign Overview HiFi.dc.html on the --qd-* token
 * system. Two columns below the shell top bar: main column (story arcs · open threads ·
 * recent beats) and a right rail (next session · the party · world state). The design's
 * own logo/brand strip is omitted — the app shell already provides it. Content is the
 * design's mock data, held in arrays so it wires to real campaign data later.
 */

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

const ARCS = [
  {
    label: 'ACT I · COMPLETE',
    labelColor: 'var(--qd-success-bright)',
    title: 'The Long Road North',
    titleColor: 'var(--qd-ink)',
    border: 'var(--qd-success-deeper)',
    bg: 'rgba(95,143,69,.07)',
    barWidth: '100%',
    barBg: 'linear-gradient(90deg,var(--qd-success-deep),var(--qd-success-bright))',
    opacity: 1,
  },
  {
    label: 'ACT II · ACTIVE',
    labelColor: 'var(--qd-accent-text)',
    title: 'The Festival Assassination',
    titleColor: 'var(--qd-ink-strong)',
    border: 'var(--qd-border-accent)',
    bg: 'linear-gradient(180deg,rgba(217,138,61,.12),rgba(0,0,0,.12))',
    barWidth: '58%',
    barBg: 'linear-gradient(90deg,var(--qd-danger),var(--qd-accent-bright))',
    opacity: 1,
  },
  {
    label: 'ACT III · LOCKED',
    labelColor: 'var(--qd-ink-faint)',
    title: 'The Seventh Chain',
    titleColor: 'var(--qd-ink-muted)',
    border: 'var(--qd-border)',
    bg: 'rgba(255,255,255,.02)',
    barWidth: '0%',
    barBg: 'transparent',
    opacity: 0.7,
  },
];

const THREADS = [
  {
    dot: 'var(--qd-danger-bright)',
    glow: 'rgba(224,88,74,.7)',
    title: 'The reality tear over Concordia',
    titleColor: 'var(--qd-ink)',
    sub: 'widening each session',
    tag: 'HOT',
    tagColor: 'var(--qd-danger-hi)',
    tagBg: 'rgba(196,69,58,.14)',
    tagBorder: 'var(--qd-border-accent)',
    opacity: 1,
  },
  {
    dot: 'var(--qd-accent-bright)',
    glow: 'rgba(217,138,61,.7)',
    title: "Whose face does Faeren wear next?",
    titleColor: 'var(--qd-ink)',
    sub: "hinted at Norm's mentor",
    tag: 'WARM',
    tagColor: 'var(--qd-accent-text)',
    tagBg: 'rgba(217,138,61,.12)',
    tagBorder: 'rgba(217,138,61,.35)',
    opacity: 1,
  },
  {
    dot: 'var(--qd-accent-bright)',
    glow: 'rgba(217,138,61,.7)',
    title: "The Duskfall Blade's true owner",
    titleColor: 'var(--qd-ink)',
    sub: 'seen weeping on Draven',
    tag: 'WARM',
    tagColor: 'var(--qd-accent-text)',
    tagBg: 'rgba(217,138,61,.12)',
    tagBorder: 'rgba(217,138,61,.35)',
    opacity: 1,
  },
  {
    dot: 'var(--qd-ink-faint)',
    glow: 'transparent',
    title: "Saltmere's missing tax barge",
    titleColor: 'var(--qd-ink-2)',
    sub: 'set aside since session 5',
    tag: 'COLD',
    tagColor: 'var(--qd-ink-muted)',
    tagBg: 'rgba(255,255,255,.04)',
    tagBorder: 'var(--qd-border-strong)',
    opacity: 0.8,
  },
];

const BEATS = [
  {
    title: 'Arrived at Concordia under two moons',
    titleColor: 'var(--qd-ink)',
    meta: 'SESSION 9 · this week',
    dot: 'var(--qd-accent-bright)',
    glow: true,
  },
  {
    title: "Faeren revealed herself behind Valdris's face",
    titleColor: 'var(--qd-ink-2)',
    meta: 'SESSION 8',
    dot: 'var(--qd-ink-muted)',
    glow: false,
  },
  {
    title: 'Bonfire Keep pledged the first anchor',
    titleColor: 'var(--qd-ink-2)',
    meta: 'SESSION 7',
    dot: 'var(--qd-ink-muted)',
    glow: false,
  },
];

const PARTY = [
  { initial: 'S', name: 'Skreek', meta: 'Rogue · Lv 7' },
  { initial: 'O', name: 'Oriyen', meta: 'Monk · Lv 7' },
  { initial: 'N', name: 'Norm', meta: 'Warlock · Lv 7' },
];

const WORLD_STATE = [
  {
    label: 'Concordia stability',
    value: 'low',
    valueColor: 'var(--qd-danger-hi)',
    barWidth: '22%',
    barBg: 'linear-gradient(90deg,var(--qd-danger-deep),var(--qd-danger))',
  },
  {
    label: 'Party renown',
    value: 'rising',
    valueColor: 'var(--qd-success-bright)',
    barWidth: '64%',
    barBg: 'linear-gradient(90deg,var(--qd-success-deep),var(--qd-success-bright))',
  },
  {
    label: 'The tear',
    value: 'spreading',
    valueColor: 'var(--qd-accent-text)',
    barWidth: '48%',
    barBg: 'linear-gradient(90deg,var(--qd-arcane-deep),var(--qd-arcane))',
  },
];

function Bar({ width, bg }: { width: string; bg: string }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-[4px]" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="h-full" style={{ width, background: bg }} />
    </div>
  );
}

export default function CampaignOverviewPage() {
  return (
    <div className="flex h-full min-h-0">
      {/* ===== MAIN ===== */}
      <div className="flex-1 overflow-auto border-r border-[var(--qd-border-faint)] px-6 py-5">
        {/* arcs */}
        <div className={`${mono} mb-[11px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>STORY ARCS</div>
        <div className="grid grid-cols-3 gap-3">
          {ARCS.map((a) => (
            <div
              key={a.title}
              className="rounded-[13px] border px-3.5 py-[13px]"
              style={{ borderColor: a.border, background: a.bg, opacity: a.opacity }}
            >
              <div className={`${mono} text-[8px]`} style={{ color: a.labelColor }}>{a.label}</div>
              <div className="mt-1.5 text-[15px]" style={{ color: a.titleColor }}>{a.title}</div>
              <Bar width={a.barWidth} bg={a.barBg} />
            </div>
          ))}
        </div>

        {/* threads */}
        <div className={`${mono} mb-[11px] mt-[22px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>OPEN THREADS · 4</div>
        <div className="flex flex-col gap-2">
          {THREADS.map((t) => (
            <div
              key={t.title}
              className="flex items-center gap-[11px] rounded-[12px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] px-[13px] py-[11px]"
              style={{ opacity: t.opacity }}
            >
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: t.dot, boxShadow: `0 0 8px ${t.glow}` }}
              />
              <div className="flex-1">
                <div className="text-[14px]" style={{ color: t.titleColor }}>{t.title}</div>
                <div className={`${mono} mt-px text-[8px] text-[var(--qd-ink-muted)]`}>{t.sub}</div>
              </div>
              <span
                className={`${mono} flex-none rounded-[20px] border px-[9px] py-1 text-[8px]`}
                style={{ color: t.tagColor, background: t.tagBg, borderColor: t.tagBorder }}
              >
                {t.tag}
              </span>
            </div>
          ))}
        </div>

        {/* recent beats */}
        <div className={`${mono} mb-[11px] mt-[22px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>RECENT BEATS</div>
        <div className="flex flex-col gap-[13px] pl-4" style={{ borderLeft: '2px solid rgba(217,138,61,.3)' }}>
          {BEATS.map((b) => (
            <div key={b.title} className="relative">
              <span
                className="absolute left-[-21px] top-1 h-2 w-2 rounded-full"
                style={{ background: b.dot, boxShadow: b.glow ? `0 0 8px ${b.dot}` : undefined }}
              />
              <div className="text-[14px]" style={{ color: b.titleColor }}>{b.title}</div>
              <div className={`${mono} mt-0.5 text-[8px] text-[var(--qd-ink-faint)]`}>{b.meta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== RIGHT RAIL ===== */}
      <aside className="flex w-[320px] flex-none flex-col gap-[18px] overflow-auto bg-[rgba(0,0,0,0.16)] px-[18px] py-5">
        {/* next session */}
        <div
          className="rounded-[14px] border p-3.5"
          style={{ borderColor: 'var(--qd-border-accent)', background: 'linear-gradient(180deg,rgba(217,138,61,.1),rgba(0,0,0,.12))' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="v3-dot-pulse h-2 w-2 flex-none rounded-full"
              style={{ background: 'var(--qd-accent)', boxShadow: '0 0 10px var(--qd-accent)' }}
            />
            <span className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-accent-text)]`}>NEXT SESSION</span>
          </div>
          <div className="mt-[9px] text-[17px] text-[var(--qd-accent-hi)]">Session 10 · Friday</div>
          <div className="mt-1 text-[12px] leading-[1.45] text-[var(--qd-ink-muted)]">
            Pick up mid-festival. The blade is about to be drawn.
          </div>
        </div>

        {/* party */}
        <div>
          <div className={`${mono} mb-2.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>THE PARTY</div>
          <div className="flex flex-col gap-2">
            {PARTY.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-[13px] font-bold"
                  style={{
                    borderColor: 'var(--qd-success)',
                    background: 'radial-gradient(circle,rgba(127,174,90,.3),rgba(0,0,0,.4))',
                    color: 'var(--qd-success-hi)',
                  }}
                >
                  {p.initial}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] text-[var(--qd-ink)]">{p.name}</div>
                  <div className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>{p.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* world state */}
        <div>
          <div className={`${mono} mb-2.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>WORLD STATE</div>
          <div className="flex flex-col gap-[11px]">
            {WORLD_STATE.map((w) => (
              <div key={w.label}>
                <div className="flex justify-between text-[12px] text-[var(--qd-ink-2)]">
                  <span>{w.label}</span>
                  <span style={{ color: w.valueColor }}>{w.value}</span>
                </div>
                <Bar width={w.barWidth} bg={w.barBg} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
