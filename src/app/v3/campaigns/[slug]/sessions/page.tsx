'use client';

/**
 * v3 Sessions — Session Flow run sheet, wired to live tRPC data.
 *
 * Visual layout is unchanged from the static design
 * (docs/assets/designs/v3/designs/Session Flow HiFi.dc.html). Three columns:
 * tonight's beats rail · current beat (read-aloud, tools, if/then) · live
 * session tools (timer, party, next beat). The hardcoded mock arrays were
 * replaced with live queries + typed adapters + loading/empty/error states.
 *
 * Data sources:
 *   - Current session       → sessions.getAll  (pick active/planning, else most recent)
 *   - Tonight's beats        → sessionPhases.list
 *   - If / then branches     → sessionRoutes.list
 *   - Read-aloud + secrets   → session prepData.scenes[].readAloud + prepSecrets.list (DM)
 *
 * Static / TODO (no clean DB source — see inline notes):
 *   - REC + Session timer    → UI-only, no elapsed-time field on the session
 *   - Beat tools             → presentational action buttons (push scene, reveal, cue, combat)
 *   - Party HP               → no per-session HP aggregation wired; defaults to '—'
 */

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { LiveTranscriptPanel } from '@/components/session/v3/LiveTranscriptPanel';
import { DiscordRecordControl } from '@/components/discord/DiscordRecordControl';
import { useLiveCapture } from '@/hooks/useLiveCapture';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

type BeatState = 'done' | 'now' | 'combat' | 'planned';

interface Beat {
  id: string;
  name: string;
  meta: string;
  state: BeatState;
  badge: string; // glyph or number for the leading marker
}

interface Branch {
  id: string;
  description: string;
}

// --- Adapters (live Prisma shapes → presentational shapes) -----------------

type PhaseRow = {
  id: string;
  name: string;
  targetMinutes: number;
  orderIndex: number;
  notes?: string | null;
};

type RouteRow = {
  id: string;
  name: string;
  description?: string | null;
  benefits: string[];
  risks: string[];
  isActive: boolean;
  orderIndex: number;
};

type PrepScene = { title?: string; readAloud?: string; order?: number };

// SessionPhase has no status field in the DB. We treat the active route's beat
// as "now"; everything before it is "done", combat-ish beats render with the
// sword marker. This is a best-effort visual mapping until phase-state lands.
// TODO: add an explicit phase status/elapsed field to drive done/now precisely.
function phaseToBeat(p: PhaseRow, index: number, nowIndex: number): Beat {
  let state: BeatState;
  let badge: string;
  if (index < nowIndex) {
    state = 'done';
    badge = '✓';
  } else if (index === nowIndex) {
    state = 'now';
    badge = '▸';
  } else if (/combat|battle|fight|ambush/i.test(p.name)) {
    state = 'combat';
    badge = '⚔';
  } else {
    state = 'planned';
    badge = String(index + 1);
  }

  const metaParts: string[] = [];
  if (state === 'now') metaParts.push('NOW');
  else if (state === 'done') metaParts.push('done');
  else if (state === 'combat') metaParts.push('next');
  else metaParts.push('planned');
  if (p.targetMinutes) metaParts.push(`${p.targetMinutes} min`);

  return { id: p.id, name: p.name, meta: metaParts.join(' · '), state, badge };
}

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

// Beat tools are presentational actions (push scene / reveal / cue / combat).
// There is no DB-backed "tool" list — these stay static buttons. TODO: wire to
// scene-push, secret-reveal, and combat-start mutations once those flows exist.
const TOOLS = [
  { label: 'Push Theatre scene ▸', bold: 600, bg: 'rgba(217,138,61,.14)', border: 'rgba(217,138,61,.45)', color: 'var(--qd-accent-text)' },
  { label: 'Reveal secret', bold: 400, bg: 'rgba(176,143,208,.12)', border: 'rgba(176,143,208,.4)', color: 'var(--qd-arcane-bright)' },
  { label: '♪ Cue music', bold: 400, bg: 'rgba(95,143,69,.12)', border: 'rgba(95,143,69,.4)', color: 'var(--qd-success-hi)' },
  { label: '⚔ Start combat ▸', bold: 700, bg: 'rgba(196,69,58,.16)', border: 'rgba(196,69,58,.5)', color: 'var(--qd-danger-hi)' },
];

export default function SessionsPage() {
  const { campaignId, isDM } = useCampaign();

  const sessions = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });

  // Pick the session that drives the run sheet: prefer an active/planning
  // session, otherwise the most recent (sessions come back sessionNumber desc).
  const current = useMemo(() => {
    const list = (sessions.data ?? []) as Array<{
      id: string;
      title?: string | null;
      sessionNumber: number;
      status?: string | null;
      prepData?: unknown;
    }>;
    if (!list.length) return null;
    return (
      list.find((s) => s.status === 'in_progress') ??
      list.find((s) => s.status === 'planning') ??
      list[0]
    );
  }, [sessions.data]);

  const sessionId = current?.id ?? '';

  const phases = trpc.sessionPhases.list.useQuery(
    { campaignId, sessionId },
    { enabled: !!sessionId, staleTime: 30_000 },
  );
  const routes = trpc.sessionRoutes.list.useQuery(
    { campaignId, sessionId },
    { enabled: !!sessionId, staleTime: 30_000 },
  );
  // Secrets are DM-only intel — only query them when the viewer is the DM.
  const secrets = trpc.prepSecrets.list.useQuery(
    { campaignId, sessionId },
    { enabled: !!sessionId && isDM, staleTime: 30_000 },
  );
  // Live party HP, aggregated from this session's character/player states.
  const partyHp = trpc.sessions.getPartyHp.useQuery(
    { sessionId },
    { enabled: !!sessionId, staleTime: 15_000 },
  );

  const phaseRows = (phases.data as PhaseRow[] | undefined) ?? [];
  const routeRows = (routes.data as RouteRow[] | undefined) ?? [];
  const partyRows = (partyHp.data as Array<{ id: string; name: string; hp: number; maxHp: number; tempHp: number }> | undefined) ?? [];

  // Live capture is explicit (joining as DM starts a billable AssemblyAI session),
  // so it's off until the DM hits "Go live". Streams mic PCM to the live pipeline.
  const [liveActive, setLiveActive] = useState(false);
  const liveCapture = useLiveCapture(campaignId, sessionId, liveActive && isDM);

  // The "now" beat is the active route's order if one is active, else the first
  // beat. SessionPhase has no status, so this is a heuristic. TODO: real state.
  const nowIndex = useMemo(() => {
    const activeRoute = routeRows.find((r) => r.isActive);
    if (activeRoute && phaseRows.length) {
      const i = phaseRows.findIndex((p) => p.orderIndex === activeRoute.orderIndex);
      if (i >= 0) return i;
    }
    return 0;
  }, [routeRows, phaseRows]);

  const beats: Beat[] = useMemo(
    () => phaseRows.map((p, i) => phaseToBeat(p, i, nowIndex)),
    [phaseRows, nowIndex],
  );

  const currentBeat = beats[nowIndex] ?? null;
  const currentPhase = phaseRows[nowIndex] ?? null;

  // Read-aloud: prefer a matching prep scene's readAloud, fall back to phase notes.
  const scenes = useMemo(() => {
    const prep = current?.prepData as { scenes?: PrepScene[] } | null | undefined;
    return (prep?.scenes ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [current]);

  const readAloud = useMemo(() => {
    if (!currentPhase) return '';
    const scene =
      scenes.find((s) => s.title && currentPhase.name && s.title.toLowerCase() === currentPhase.name.toLowerCase()) ??
      scenes[nowIndex];
    return scene?.readAloud?.trim() || currentPhase.notes?.trim() || '';
  }, [scenes, currentPhase, nowIndex]);

  // If / then branches from routes (description carries the branch text).
  const branches: Branch[] = useMemo(
    () =>
      routeRows
        .map((r) => ({ id: r.id, description: r.description?.trim() || r.name }))
        .filter((b) => b.description),
    [routeRows],
  );

  const isLoading = sessions.isLoading || (!!sessionId && (phases.isLoading || routes.isLoading));
  const hasError = sessions.error || phases.error || routes.error;

  if (sessions.isLoading) {
    return <div className="px-8 py-16 text-[var(--qd-ink-muted)]">Gathering the chronicle…</div>;
  }
  if (hasError) {
    return <div className="px-8 py-16 text-[var(--qd-ink-muted)]">The threads tangled. Try again.</div>;
  }
  if (!current) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <div className={`${display} text-[22px] text-[var(--qd-ink-strong)]`}>The chronicle is empty.</div>
          <div className={`${mono} mt-2 text-[11px] tracking-[0.08em] text-[var(--qd-ink-muted)]`}>Begin when ready.</div>
        </div>
      </div>
    );
  }

  const sessionTitle = current.title?.trim() || `Session ${current.sessionNumber}`;
  const isLive = current.status === 'in_progress';

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
          <div className="text-[18px] leading-none text-[var(--qd-ink-strong)]">
            Session {current.sessionNumber} · Run Sheet
          </div>
          <div className={`${mono} mt-[3px] text-[9px] tracking-[0.08em] text-[var(--qd-ink-muted)]`}>
            {sessionTitle.toUpperCase()} · beat by beat
          </div>
        </div>
        <div className="flex-1" />
        {/* REC pill is UI-only — there is no live elapsed-time field. TODO: drive from a real timer. */}
        {isLive && (
          <span
            className={`${mono} flex items-center gap-[7px] rounded-[20px] border px-3 py-1.5 text-[9px]`}
            style={{ color: 'var(--qd-danger-hi)', background: 'rgba(196,69,58,.12)', borderColor: 'rgba(196,69,58,.4)' }}
          >
            <span className="v3-rec-blink h-[7px] w-[7px] rounded-full" style={{ background: 'var(--qd-danger)', boxShadow: '0 0 8px var(--qd-danger)' }} />
            REC · LIVE
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== BEATS ===== */}
        <aside className="flex w-[288px] flex-none flex-col gap-[7px] overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] px-3 py-3.5">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>TONIGHT&apos;S BEATS</div>
          {beats.length === 0 ? (
            <p className={`${mono} px-1 py-6 text-center text-[10px] text-[var(--qd-ink-muted)]`}>No beats charted yet.</p>
          ) : (
            beats.map((b) => <BeatRow key={b.id} beat={b} />)
          )}
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
          {isLoading ? (
            <div className="text-[var(--qd-ink-muted)]">Charting the night…</div>
          ) : !currentBeat ? (
            <div>
              <div className={`${display} text-[22px] text-[var(--qd-ink-strong)]`}>No beat is running.</div>
              <div className={`${mono} mt-2 text-[10px] tracking-[0.08em] text-[var(--qd-ink-muted)]`}>Chart a beat to begin the run sheet.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="v3-dot-pulse h-2 w-2 flex-none rounded-full" style={{ background: 'var(--qd-accent)', boxShadow: '0 0 10px var(--qd-accent)' }} />
                <span className={`${mono} text-[9px] tracking-[0.14em] text-[var(--qd-accent-bright)]`}>
                  RUNNING NOW · BEAT {nowIndex + 1} OF {beats.length}
                </span>
              </div>
              <div className="mt-[9px] text-[28px] text-[var(--qd-ink-strong)]">{currentBeat.name}</div>

              {/* read aloud */}
              {readAloud && (
                <div className="mt-[18px] border-l-[3px] pl-4" style={{ borderColor: 'var(--qd-border-accent)' }}>
                  <div className={`${mono} mb-[7px] text-[8px] tracking-[0.14em] text-[var(--qd-ink-muted)]`}>READ ALOUD</div>
                  <div className="max-w-[620px] text-[17px] italic leading-[1.6] text-[var(--qd-ink-2)]">
                    &quot;{readAloud}&quot;
                  </div>
                </div>
              )}

              {/* beat tools (static actions) */}
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

              {/* if / then (from routes) */}
              {branches.length > 0 && (
                <div className="mt-5 rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] px-[15px] py-3.5">
                  <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>IF / THEN</div>
                  <div className="text-[13.5px] leading-[1.6] text-[var(--qd-ink-2)]">
                    {branches.map((b) => (
                      <div key={b.id}>• {b.description}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* secrets — DM only */}
              {isDM && (secrets.data?.length ?? 0) > 0 && (
                <div
                  className="mt-5 rounded-[13px] border px-[15px] py-3.5"
                  style={{ borderColor: 'var(--qd-border-accent)', background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' }}
                >
                  <div className={`${mono} mb-2 text-[8px] tracking-[0.12em] text-[var(--qd-accent-text)]`}>▸ SECRETS</div>
                  <div className="flex flex-col gap-1.5 text-[13.5px] italic leading-[1.6] text-[var(--qd-ink-2)]">
                    {(secrets.data ?? []).map((s) => (
                      <div key={s.id}>
                        <span className="not-italic text-[var(--qd-ink-strong)]">{s.name}:</span> {s.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ===== TOOLS ===== */}
        <aside className="flex w-[268px] flex-none flex-col gap-3.5 overflow-auto border-l border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.16)] p-[18px]">
          {/* Session timer is UI-only (no elapsed-time DB field). Show planned
              target from phases; live clock stays static. TODO: real timer. */}
          <div className="rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] p-3.5 text-center">
            <div className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-ink-muted)]`}>SESSION TIME</div>
            <div className={`${display} mt-1.5 text-[30px] font-bold text-[var(--qd-accent-hi)]`}>—</div>
            <div className={`${mono} mt-0.5 text-[8px] text-[var(--qd-ink-faint)]`}>
              target {Math.round(phaseRows.reduce((sum, p) => sum + (p.targetMinutes || 0), 0) / 60) || '—'}h planned
            </div>
          </div>

          <button className={`${display} flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] p-3 text-[14px] text-[var(--qd-ink-2)]`}>
            <MaskedDndIcon name="dice/roll" size={15} /> Quick roll
          </button>
          <button className={`${display} cursor-pointer rounded-[11px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] p-3 text-[14px] text-[var(--qd-ink-2)]`}>
            🗒 Session note
          </button>

          {/* PARTY · live — aggregated from this session's character/player states. */}
          <div className="flex-1 rounded-[13px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.02)] p-[13px]">
            <div className={`${mono} text-[8px] tracking-[0.12em] text-[var(--qd-ink-muted)]`}>PARTY · live</div>
            {partyRows.length === 0 ? (
              <div className={`${mono} mt-2.5 text-[10px] text-[var(--qd-ink-faint)]`}>
                No live HP tracked for this session yet.
              </div>
            ) : (
              <div className="mt-2.5 flex flex-col gap-2" data-testid="party-hp">
                {partyRows.map((m) => {
                  const pct = m.maxHp > 0 ? Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100)) : 0;
                  const bloodied = m.maxHp > 0 && m.hp <= Math.floor(m.maxHp / 2);
                  return (
                    <div key={m.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] text-[var(--qd-ink-2)]">{m.name}</span>
                        <span className={`${mono} flex-none text-[9px]`} style={{ color: bloodied ? 'var(--qd-danger-bright)' : 'var(--qd-ink-muted)' }}>
                          {m.hp}/{m.maxHp}{m.tempHp > 0 ? ` +${m.tempHp}` : ''}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bloodied ? 'var(--qd-grad-danger)' : 'var(--qd-grad-success)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIVE — explicit go-live (cost-safe), captions + DM hints while live. */}
          {current.status === 'in_progress' && sessionId && (
            <>
              {isDM && (
                <button
                  onClick={() => setLiveActive((v) => !v)}
                  data-testid="go-live"
                  className={`${display} flex items-center justify-center gap-2 rounded-[11px] p-3 text-[14px] font-bold`}
                  style={
                    liveActive
                      ? { border: '1px solid var(--qd-danger-bright)', color: 'var(--qd-danger-bright)', background: 'rgba(196,69,58,.08)' }
                      : { border: 'none', color: 'var(--qd-on-accent)', background: 'linear-gradient(180deg,var(--qd-accent-bright),var(--qd-accent-deep))' }
                  }
                >
                  {liveActive ? '■ Stop live' : '● Go live'}
                </button>
              )}
              {liveActive && liveCapture.error && (
                <div className={`${mono} text-[9px] text-[var(--qd-danger-bright)]`}>{liveCapture.error}</div>
              )}
              {isDM && <DiscordRecordControl campaignId={campaignId} sessionId={sessionId} />}
              <LiveTranscriptPanel campaignId={campaignId} sessionId={sessionId} isLive={liveActive} />
            </>
          )}

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
