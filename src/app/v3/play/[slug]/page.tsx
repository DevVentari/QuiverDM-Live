'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

// ── Defensive shapes (subset of play.getCampaignHub + scenes.list) ──────────
interface HubCharacter {
  name?: string | null;
  class?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
}
interface HubMember {
  userId?: string | null;
  role?: string | null;
  user?: { id?: string | null; name?: string | null; image?: string | null } | null;
}
interface HubSession {
  id: string;
  title?: string | null;
  status?: string | null;
  aiSummary?: string | null;
  sessionNumber?: number | null;
}
interface CampaignHub {
  id: string;
  name?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  members?: HubMember[] | null;
  sessions?: HubSession[] | null;
  character?: HubCharacter | null;
}
interface SceneRow {
  id: string;
  title?: string | null;
  type?: string | null;
  description?: string | null;
  isPresented?: boolean | null;
}

const dash = (v?: string | null) => (v && v.trim() ? v : '—');
const initial = (s?: string | null) => (s && s.trim() ? s.trim().charAt(0).toUpperCase() : '?');

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 font-[family-name:var(--qd-font-mono)] text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
      {children}
    </div>
  );
}

export default function PlayerLobbyPage() {
  const { slug } = useParams() as { slug: string };

  const hubQ = trpc.play.getCampaignHub.useQuery({ slug }, { staleTime: 30_000 });
  const hub = hubQ.data as CampaignHub | undefined;
  const campaignId = hub?.id;

  const scenesQ = trpc.scenes.list.useQuery(
    { campaignId: campaignId ?? '' },
    { enabled: !!campaignId, staleTime: 15_000 },
  );

  const liveScene = useMemo(() => {
    const rows = (scenesQ.data as SceneRow[] | undefined) ?? [];
    return rows.find((s) => s.isPresented) ?? null;
  }, [scenesQ.data]);

  // ── Loading / error ──────────────────────────────────────────────────────
  if (hubQ.isLoading) {
    return <div className="px-6 py-20 text-center text-qd-ink-muted">Approaching the table…</div>;
  }
  if (hubQ.error || !hub) {
    return <div className="px-6 py-20 text-center text-qd-ink-muted">The threads tangled. Try again.</div>;
  }

  const character = hub.character ?? null;
  const members = (hub.members ?? []).filter((m): m is HubMember => !!m);
  const recap = (hub.sessions ?? []).find((s) => s?.aiSummary) ?? (hub.sessions ?? [])[0] ?? null;
  const nextSession = (hub.sessions ?? [])[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[460px] px-5 pb-16 pt-6">
      {/* ── Splash / campaign title ─────────────────────────────────────── */}
      <section className="border-b border-qd-faint pb-5">
        <div className="font-[family-name:var(--qd-font-mono)] text-[8.5px] uppercase tracking-[0.2em] text-qd-accent-text">
          You&rsquo;ve joined
        </div>
        <h1 className="mt-1.5 font-qd-display text-[28px] leading-[1.05] text-qd-ink-strong">
          {dash(hub.name)}
        </h1>
        {hub.description ? (
          <p className="mt-2 text-qd-body-sm leading-relaxed text-qd-ink-2">{hub.description}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-2 font-[family-name:var(--qd-font-mono)] text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
          <MaskedDndIcon name="campaign/yawning-portal" size={12} className="text-qd-accent" />
          {nextSession?.sessionNumber != null ? <span>Session {nextSession.sessionNumber}</span> : null}
          {nextSession?.title ? <span className="text-qd-ink-faint">· {nextSession.title}</span> : null}
        </div>
      </section>

      {/* ── Your hero ───────────────────────────────────────────────────── */}
      <section className="pt-6">
        <Overline>Your hero</Overline>
        {character ? (
          <div
            className="flex items-center gap-3.5 rounded-qd-lg border border-qd-accent p-3.5"
            style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.14),rgba(0,0,0,.16))' }}
          >
            <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-qd-lg border-2 border-qd-accent text-xl font-bold text-qd-on-accent" style={{ background: 'radial-gradient(circle,rgba(217,138,61,.3),rgba(0,0,0,.4))' }}>
              {character.portraitUrl
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={character.portraitUrl} alt={dash(character.name)} className="h-full w-full object-cover" />
                : initial(character.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-qd-display text-lg leading-none text-qd-ink-strong">{dash(character.name)}</div>
              <div className="mt-1.5 font-[family-name:var(--qd-font-mono)] text-[8.5px] uppercase tracking-[0.08em] text-qd-ink-muted">
                {dash(character.class)}
                {character.level != null ? ` · LV ${character.level}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-qd-lg border border-dashed border-qd-strong p-4 text-center text-qd-body-sm text-qd-ink-muted">
            No hero claimed yet — your DM will seat you.
          </div>
        )}
      </section>

      {/* ── Live scene ──────────────────────────────────────────────────── */}
      <section className="pt-6">
        <Overline>The scene</Overline>
        {liveScene ? (
          <div
            className="rounded-qd-lg border border-qd-accent p-4"
            style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.1),rgba(0,0,0,.12))' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: 'var(--qd-accent)', boxShadow: '0 0 12px var(--qd-accent)' }} />
              <span className="font-qd-display text-[15px] text-qd-ink-strong">{dash(liveScene.title)}</span>
            </div>
            <p className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">
              {liveScene.description?.trim() ? liveScene.description : 'The moment unfolds before you.'}
            </p>
          </div>
        ) : (
          <div className="rounded-qd-lg border border-qd-faint p-5 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
            <p className="font-qd-display text-[15px] text-qd-ink-2">The DM is preparing…</p>
            <p className="mt-1 text-qd-body-sm text-qd-ink-muted">the table is quiet.</p>
          </div>
        )}
      </section>

      {/* ── At the table ────────────────────────────────────────────────── */}
      <section className="pt-6">
        <Overline>At the table · {members.length}</Overline>
        <div className="flex flex-col gap-2">
          {members.length === 0 ? (
            <p className="py-4 text-center text-qd-body-sm text-qd-ink-muted">No one is seated yet.</p>
          ) : (
            members.map((m, i) => {
              const u = m.user ?? null;
              const name = dash(u?.name);
              return (
                <div
                  key={u?.id ?? m.userId ?? i}
                  className="flex items-center gap-3 rounded-qd-lg border border-qd-faint p-2.5"
                  style={{ background: 'rgba(255,255,255,.02)' }}
                >
                  <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full text-[13px] font-bold text-qd-on-accent" style={{ background: 'radial-gradient(circle,#7fae5a,rgba(0,0,0,.4))' }}>
                    {u?.image
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={u.image} alt={name} className="h-full w-full object-cover" />
                      : initial(u?.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-qd-ink-strong">{name}</div>
                    <div className="font-[family-name:var(--qd-font-mono)] text-[8px] uppercase tracking-[0.08em] text-qd-ink-faint">{dash(m.role)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Last recap teaser ───────────────────────────────────────────── */}
      {recap?.aiSummary ? (
        <section className="pt-6">
          <Overline>Last time</Overline>
          <div className="rounded-qd-lg border border-qd-faint p-3.5" style={{ background: 'rgba(255,255,255,.02)' }}>
            <p className="line-clamp-4 text-qd-body-sm italic leading-relaxed text-qd-ink-2">{recap.aiSummary}</p>
            <div className="mt-2.5 font-[family-name:var(--qd-font-mono)] text-[9px] text-qd-accent-text">
              {dash(recap.title)} ▸
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
