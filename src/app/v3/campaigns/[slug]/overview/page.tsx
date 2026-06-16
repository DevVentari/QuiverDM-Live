'use client';

/**
 * v3 Campaign Overview — rebuilt from
 * docs/assets/designs/v3/designs/Campaign Overview HiFi.dc.html on the --qd-* token
 * system. Two columns below the shell top bar: main column (story arcs · open threads ·
 * recent beats) and a right rail (next session · the party · world state).
 *
 * Wired to live tRPC data:
 *  - Story arcs   → brain.entities.list({ type: 'ARC' })       (DM-gated)
 *  - Open threads → brain.entities.list({ type: 'THREAT'|'SECRET' }) (DM-gated)
 *  - Recent beats → sessions.getAll (recent sessions)
 *  - Next session → sessions.getAll (latest non-completed, else latest)
 *  - The party    → characters.getCampaignCharacters
 *  - World state  → brain.state.get (pressure tracks)          (DM-gated)
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

const mono = 'font-[family-name:var(--qd-font-mono)]';

// ---------------------------------------------------------------------------
// Adapters — typed view-models mirroring the design's mock arrays.
// ---------------------------------------------------------------------------

interface ArcView {
  id: string;
  label: string;
  labelColor: string;
  title: string;
  titleColor: string;
  border: string;
  bg: string;
  barWidth: string;
  barBg: string;
  opacity: number;
}

interface ThreadView {
  id: string;
  dot: string;
  glow: string;
  title: string;
  titleColor: string;
  sub: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  tagBorder: string;
  opacity: number;
}

interface BeatView {
  id: string;
  title: string;
  titleColor: string;
  meta: string;
  dot: string;
  glow: boolean;
}

interface PartyView {
  id: string;
  initial: string;
  name: string;
  meta: string;
  hpLabel: string; // "current/max" or "—"
  hpPct: number | null; // 0..100 for the bar, or null when HP is unknown
}

interface TrackView {
  label: string;
  value: string;
  valueColor: string;
  barWidth: string;
  barBg: string;
}

// Brain entity shape (subset of WorldEntity returned by brain.entities.list).
interface EntityRow {
  id: string;
  name: string;
  description?: string | null;
  status?: 'active' | 'dormant' | 'destroyed' | 'resolved' | string | null;
  properties?: Record<string, unknown> | null;
}

// Session shape (subset of GameSession returned by sessions.getAll).
interface SessionRow {
  id: string;
  sessionNumber: number;
  title?: string | null;
  status?: string | null;
  recap?: string | null;
  date?: string | Date | null;
}

// Campaign-character shape (subset returned by characters.getCampaignCharacters).
interface CampaignCharacterRow {
  id: string;
  character: {
    id: string;
    name: string;
    class?: string | null;
    level?: number | null;
    hitPoints?: { current?: number | null; max?: number | null; temp?: number | null } | null;
  };
}

// ARC entity status → design "act" treatment. progress % has no clean source,
// so it's derived from status rather than a real bar value. // TODO: real arc progress.
function arcFromEntity(e: EntityRow): ArcView {
  const status = (e.status ?? 'active').toLowerCase();
  if (status === 'resolved' || status === 'destroyed') {
    return {
      id: e.id,
      label: 'ARC · COMPLETE',
      labelColor: 'var(--qd-success-bright)',
      title: e.name,
      titleColor: 'var(--qd-ink)',
      border: 'var(--qd-success-deeper)',
      bg: 'rgba(95,143,69,.07)',
      barWidth: '100%',
      barBg: 'linear-gradient(90deg,var(--qd-success-deep),var(--qd-success-bright))',
      opacity: 1,
    };
  }
  if (status === 'dormant') {
    return {
      id: e.id,
      label: 'ARC · DORMANT',
      labelColor: 'var(--qd-ink-faint)',
      title: e.name,
      titleColor: 'var(--qd-ink-muted)',
      border: 'var(--qd-border)',
      bg: 'rgba(255,255,255,.02)',
      barWidth: '0%',
      barBg: 'transparent',
      opacity: 0.7,
    };
  }
  // active
  return {
    id: e.id,
    label: 'ARC · ACTIVE',
    labelColor: 'var(--qd-accent-text)',
    title: e.name,
    titleColor: 'var(--qd-ink-strong)',
    border: 'var(--qd-border-accent)',
    bg: 'linear-gradient(180deg,rgba(217,138,61,.12),rgba(0,0,0,.12))',
    barWidth: '58%', // TODO: no real arc progress field — placeholder for active arcs.
    barBg: 'linear-gradient(90deg,var(--qd-danger),var(--qd-accent-bright))',
    opacity: 1,
  };
}

// THREAT/SECRET entity status → thread "heat" tag. WorldEntityStatus has no
// HOT/WARM/COLD; mapped from active→HOT, resolved/destroyed→COLD, dormant→WARM.
function threadFromEntity(e: EntityRow): ThreadView {
  const status = (e.status ?? 'active').toLowerCase();
  const sub = (e.description ?? '').trim().slice(0, 80) || 'an open thread';
  if (status === 'active') {
    return {
      id: e.id,
      dot: 'var(--qd-danger-bright)',
      glow: 'rgba(224,88,74,.7)',
      title: e.name,
      titleColor: 'var(--qd-ink)',
      sub,
      tag: 'HOT',
      tagColor: 'var(--qd-danger-hi)',
      tagBg: 'rgba(196,69,58,.14)',
      tagBorder: 'var(--qd-border-accent)',
      opacity: 1,
    };
  }
  if (status === 'dormant') {
    return {
      id: e.id,
      dot: 'var(--qd-accent-bright)',
      glow: 'rgba(217,138,61,.7)',
      title: e.name,
      titleColor: 'var(--qd-ink)',
      sub,
      tag: 'WARM',
      tagColor: 'var(--qd-accent-text)',
      tagBg: 'rgba(217,138,61,.12)',
      tagBorder: 'rgba(217,138,61,.35)',
      opacity: 1,
    };
  }
  // resolved / destroyed
  return {
    id: e.id,
    dot: 'var(--qd-ink-faint)',
    glow: 'transparent',
    title: e.name,
    titleColor: 'var(--qd-ink-2)',
    sub,
    tag: 'COLD',
    tagColor: 'var(--qd-ink-muted)',
    tagBg: 'rgba(255,255,255,.04)',
    tagBorder: 'var(--qd-border-strong)',
    opacity: 0.8,
  };
}

function beatFromSession(s: SessionRow, isLatest: boolean): BeatView {
  const title = s.title?.trim() || (s.recap?.trim().slice(0, 70)) || `Session ${s.sessionNumber}`;
  return {
    id: s.id,
    title,
    titleColor: isLatest ? 'var(--qd-ink)' : 'var(--qd-ink-2)',
    meta: `SESSION ${s.sessionNumber}${isLatest ? ' · latest' : ''}`,
    dot: isLatest ? 'var(--qd-accent-bright)' : 'var(--qd-ink-muted)',
    glow: isLatest,
  };
}

function partyFromCharacter(cc: CampaignCharacterRow): PartyView {
  const c = cc.character;
  const meta = [c.class, c.level != null ? `Lv ${c.level}` : null].filter(Boolean).join(' · ') || '—';
  // HP lives in the structured `hitPoints` JSON ({ current, max, temp }); read defensively.
  const cur = c.hitPoints?.current;
  const max = c.hitPoints?.max;
  const hpLabel = cur != null && max != null ? `${cur}/${max}` : (cur ?? '—').toString();
  const hpPct =
    cur != null && max != null && max > 0
      ? Math.round(Math.max(0, Math.min(1, cur / max)) * 100)
      : null;
  return {
    id: cc.id,
    initial: (c.name.charAt(0) || '?').toUpperCase(),
    name: c.name,
    meta,
    hpLabel,
    hpPct,
  };
}

// HP bar hue shifts as the pool drains — green → amber → red.
function hpBarBg(pct: number): string {
  if (pct <= 25) return 'linear-gradient(90deg,var(--qd-danger-deep),var(--qd-danger))';
  if (pct <= 50) return 'linear-gradient(90deg,var(--qd-accent-deep,var(--qd-accent)),var(--qd-accent-bright))';
  return 'linear-gradient(90deg,var(--qd-success-deep),var(--qd-success-bright))';
}

// One pressure track (0..1 float) → labelled World State bar.
function trackFromPressure(label: string, value: number, hue: 'danger' | 'success' | 'arcane'): TrackView {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const word = value >= 0.66 ? 'critical' : value >= 0.33 ? 'rising' : 'quiet';
  const palette = {
    danger: { valueColor: 'var(--qd-danger-hi)', barBg: 'linear-gradient(90deg,var(--qd-danger-deep),var(--qd-danger))' },
    success: { valueColor: 'var(--qd-success-bright)', barBg: 'linear-gradient(90deg,var(--qd-success-deep),var(--qd-success-bright))' },
    arcane: { valueColor: 'var(--qd-accent-text)', barBg: 'linear-gradient(90deg,var(--qd-arcane-deep),var(--qd-arcane))' },
  }[hue];
  return { label, value: word, valueColor: palette.valueColor, barWidth: `${pct}%`, barBg: palette.barBg };
}

function Bar({ width, bg }: { width: string; bg: string }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-[4px]" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="h-full" style={{ width, background: bg }} />
    </div>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-[var(--qd-ink-muted)]">{children}</div>;
}

export default function CampaignOverviewPage() {
  const { campaignId, isDM } = useCampaign();
  const q = { staleTime: 60_000 } as const;

  // Brain queries are DM-gated server-side; only run them for DMs.
  const arcsQ = trpc.brain.entities.list.useQuery({ campaignId, type: 'ARC' }, { ...q, enabled: isDM });
  const threatsQ = trpc.brain.entities.list.useQuery({ campaignId, type: 'THREAT' }, { ...q, enabled: isDM });
  const secretsQ = trpc.brain.entities.list.useQuery({ campaignId, type: 'SECRET' }, { ...q, enabled: isDM });
  const stateQ = trpc.brain.state.get.useQuery({ campaignId }, { ...q, enabled: isDM });

  const sessionsQ = trpc.sessions.getAll.useQuery({ campaignId }, q);
  const partyQ = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, q);

  const arcs = useMemo<ArcView[]>(
    () => ((arcsQ.data as EntityRow[] | undefined) ?? []).map(arcFromEntity),
    [arcsQ.data],
  );

  const threads = useMemo<ThreadView[]>(() => {
    const rows = [
      ...((threatsQ.data as EntityRow[] | undefined) ?? []),
      ...((secretsQ.data as EntityRow[] | undefined) ?? []),
    ];
    const heatRank: Record<string, number> = { HOT: 0, WARM: 1, COLD: 2 };
    return rows
      .map(threadFromEntity)
      .sort((a, b) => (heatRank[a.tag] ?? 3) - (heatRank[b.tag] ?? 3));
  }, [threatsQ.data, secretsQ.data]);

  const beats = useMemo<BeatView[]>(() => {
    const rows = (sessionsQ.data as SessionRow[] | undefined) ?? [];
    // sessions.getAll is ordered by sessionNumber desc — first is most recent.
    return rows.slice(0, 4).map((s, i) => beatFromSession(s, i === 0));
  }, [sessionsQ.data]);

  const nextSession = useMemo<SessionRow | null>(() => {
    const rows = (sessionsQ.data as SessionRow[] | undefined) ?? [];
    if (!rows.length) return null;
    // Prefer an upcoming/in-prep session, else fall back to the most recent.
    const upcoming = rows.find((s) => s.status === 'planning' || s.status === 'in_progress' || s.status === 'active');
    return upcoming ?? rows[0];
  }, [sessionsQ.data]);

  const party = useMemo<PartyView[]>(
    () => ((partyQ.data as CampaignCharacterRow[] | undefined) ?? []).map(partyFromCharacter),
    [partyQ.data],
  );

  const tracks = useMemo<TrackView[]>(() => {
    const s = stateQ.data;
    if (!s) return [];
    // Map the five pressure floats onto the three "world state" bars the design shows.
    // Political (instability) is shown inverted-in-meaning as a danger track; the rest map by theme.
    return [
      trackFromPressure('Political pressure', s.pressurePolitical, 'danger'),
      trackFromPressure('Social standing', s.pressureSocial, 'success'),
      trackFromPressure('The supernatural', s.pressureSupernatural, 'arcane'),
    ];
  }, [stateQ.data]);

  const mainLoading = (isDM && (arcsQ.isLoading || threatsQ.isLoading || secretsQ.isLoading)) || sessionsQ.isLoading;
  const mainError = arcsQ.error || threatsQ.error || secretsQ.error || sessionsQ.error;

  if (mainError) {
    return <div className="px-6 py-16 text-[var(--qd-ink-muted)]">The threads tangled. Try again.</div>;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ===== MAIN ===== */}
      <div className="flex-1 overflow-auto border-r border-[var(--qd-border-faint)] px-6 py-5">
        {/* arcs */}
        <div className={`${mono} mb-[11px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>STORY ARCS</div>
        {mainLoading ? (
          <SectionEmpty>Reading the chronicle…</SectionEmpty>
        ) : !isDM ? (
          <SectionEmpty>Only the DM may read the arcs.</SectionEmpty>
        ) : arcs.length === 0 ? (
          <SectionEmpty>No arcs yet. The story has not been written.</SectionEmpty>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {arcs.map((a) => (
              <div
                key={a.id}
                className="rounded-[13px] border px-3.5 py-[13px]"
                style={{ borderColor: a.border, background: a.bg, opacity: a.opacity }}
              >
                <div className={`${mono} text-[8px]`} style={{ color: a.labelColor }}>{a.label}</div>
                <div className="mt-1.5 text-[15px]" style={{ color: a.titleColor }}>{a.title}</div>
                <Bar width={a.barWidth} bg={a.barBg} />
              </div>
            ))}
          </div>
        )}

        {/* threads */}
        <div className={`${mono} mb-[11px] mt-[22px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>
          OPEN THREADS{threads.length ? ` · ${threads.length}` : ''}
        </div>
        {mainLoading ? (
          <SectionEmpty>Following the threads…</SectionEmpty>
        ) : !isDM ? (
          <SectionEmpty>The threads are the DM&apos;s to hold.</SectionEmpty>
        ) : threads.length === 0 ? (
          <SectionEmpty>The chronicle is quiet. No threads hang loose.</SectionEmpty>
        ) : (
          <div className="flex flex-col gap-2">
            {threads.map((t) => (
              <div
                key={t.id}
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
        )}

        {/* recent beats */}
        <div className={`${mono} mb-[11px] mt-[22px] text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>RECENT BEATS</div>
        {mainLoading ? (
          <SectionEmpty>Recalling the last sessions…</SectionEmpty>
        ) : beats.length === 0 ? (
          <SectionEmpty>No sessions have been played yet.</SectionEmpty>
        ) : (
          <div className="flex flex-col gap-[13px] pl-4" style={{ borderLeft: '2px solid rgba(217,138,61,.3)' }}>
            {beats.map((b) => (
              <div key={b.id} className="relative">
                <span
                  className="absolute left-[-21px] top-1 h-2 w-2 rounded-full"
                  style={{ background: b.dot, boxShadow: b.glow ? `0 0 8px ${b.dot}` : undefined }}
                />
                <div className="text-[14px]" style={{ color: b.titleColor }}>{b.title}</div>
                <div className={`${mono} mt-0.5 text-[8px] text-[var(--qd-ink-faint)]`}>{b.meta}</div>
              </div>
            ))}
          </div>
        )}
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
          {sessionsQ.isLoading ? (
            <div className="mt-[9px] text-[13px] text-[var(--qd-ink-muted)]">Looking ahead…</div>
          ) : nextSession ? (
            <>
              <div className="mt-[9px] text-[17px] text-[var(--qd-accent-hi)]">
                {nextSession.title?.trim() || `Session ${nextSession.sessionNumber}`}
              </div>
              <div className="mt-1 text-[12px] leading-[1.45] text-[var(--qd-ink-muted)]">
                {nextSession.recap?.trim().slice(0, 120) || 'The next chapter waits to be written.'}
              </div>
            </>
          ) : (
            <div className="mt-[9px] text-[13px] text-[var(--qd-ink-muted)]">No session on the horizon yet.</div>
          )}
        </div>

        {/* party */}
        <div>
          <div className={`${mono} mb-2.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>THE PARTY</div>
          {partyQ.isLoading ? (
            <SectionEmpty>Gathering the company…</SectionEmpty>
          ) : party.length === 0 ? (
            <SectionEmpty>No heroes have answered the call.</SectionEmpty>
          ) : (
            <div className="flex flex-col gap-2">
              {party.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="truncate text-[14px] text-[var(--qd-ink)]">{p.name}</div>
                      <div className={`${mono} flex-none text-[9px] text-[var(--qd-ink-2)]`}>{p.hpLabel}</div>
                    </div>
                    <div className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>{p.meta}</div>
                    {p.hpPct != null && (
                      <Bar width={`${p.hpPct}%`} bg={hpBarBg(p.hpPct)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* world state */}
        <div>
          <div className={`${mono} mb-2.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>WORLD STATE</div>
          {!isDM ? (
            <SectionEmpty>The world&apos;s pulse is the DM&apos;s to feel.</SectionEmpty>
          ) : stateQ.isLoading ? (
            <SectionEmpty>Feeling the world&apos;s pulse…</SectionEmpty>
          ) : tracks.length === 0 ? (
            <SectionEmpty>The world is still.</SectionEmpty>
          ) : (
            <div className="flex flex-col gap-[11px]">
              {tracks.map((w) => (
                <div key={w.label}>
                  <div className="flex justify-between text-[12px] text-[var(--qd-ink-2)]">
                    <span>{w.label}</span>
                    <span style={{ color: w.valueColor }}>{w.value}</span>
                  </div>
                  <Bar width={w.barWidth} bg={w.barBg} />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
