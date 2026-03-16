'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText, Users, BookOpen, Wand2, Zap, CalendarDays } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-violet-900 text-violet-300',
  'bg-emerald-900 text-emerald-300',
  'bg-rose-900 text-rose-300',
  'bg-sky-900 text-sky-300',
  'bg-amber-900 text-amber-300',
  'bg-fuchsia-900 text-fuchsia-300',
];
function avatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function PlayCampaignHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.play.getCampaignHub.useQuery({ slug });

  if (isLoading) return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="h-[180px] rounded-sm bg-white/5" />
      <div className="grid grid-cols-4 gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white/5 rounded-sm" />)}
      </div>
      <div className="h-32 bg-white/5 rounded-sm" />
    </div>
  );
  if (!data) return null;

  const liveSession = (data.sessions as any[]).find(s => s.status === 'in_progress');
  const upcomingSession = (data.sessions as any[]).find(s => s.status === 'draft' || s.date);

  const quickActions = [
    liveSession
      ? { label: 'Join Live', href: `/play/${slug}/session`, color: 'amber', icon: Zap }
      : { label: 'Recaps', href: `/play/${slug}/sessions`, color: 'amber', icon: ScrollText },
    { label: 'Party', href: `/play/${slug}/characters`, color: 'purple', icon: Users },
    { label: 'NPCs', href: `/play/${slug}/npcs`, color: 'blue', icon: BookOpen },
    { label: 'Lore', href: `/play/${slug}/lore`, color: 'green', icon: Wand2 },
  ] as const;

  const iconBg: Record<string, string> = {
    amber: 'bg-amber-500/15 border border-amber-500/25 text-amber-400',
    purple: 'bg-violet-500/15 border border-violet-500/25 text-violet-300',
    blue: 'bg-sky-500/15 border border-sky-500/25 text-sky-300',
    green: 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300',
  };

  return (
    <div className="pb-20 px-5 space-y-5 pt-4">

      {/* Campaign hero card */}
      <div className="relative overflow-hidden rounded-sm" style={{
        height: 180,
        border: '1px solid hsl(35 50% 28%)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08), 0 4px 24px hsl(240 10% 4% / 0.6)',
      }}>
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(160deg, hsl(240 12% 12% / 0) 0%, hsl(240 10% 6% / 0.95) 65%), linear-gradient(90deg, hsl(35 80% 28% / 0.4), hsl(260 50% 28% / 0.3))',
          backgroundColor: 'hsl(240 12% 12%)',
        }} />
        {data.bannerUrl && (
          <img src={data.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" />
        )}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 100% 80% at 75% 30%, hsl(35 60% 35% / 0.4) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 20% 80%, hsl(260 50% 35% / 0.25) 0%, transparent 50%)',
        }} />
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              {liveSession ? (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full mb-2"
                  style={{ background: 'hsl(0 62% 42% / 0.25)', border: '1px solid hsl(0 62% 42% / 0.4)', color: 'hsl(0 80% 75%)' }}>
                  <Zap className="h-2.5 w-2.5" /> Live Now
                </span>
              ) : upcomingSession?.date ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full mb-2"
                  style={{ background: 'hsl(35 80% 48% / 0.18)', border: '1px solid hsl(35 80% 48% / 0.3)', color: 'hsl(35 80% 65%)' }}>
                  <CalendarDays className="h-2.5 w-2.5" />
                  {new Date(upcomingSession.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full mb-2"
                  style={{ background: 'hsl(35 80% 48% / 0.18)', border: '1px solid hsl(35 80% 48% / 0.3)', color: 'hsl(35 80% 65%)' }}>
                  {data.sessions.length} {data.sessions.length === 1 ? 'Session' : 'Sessions'}
                </span>
              )}
              <h1 className="font-display text-xl font-bold leading-tight mb-2" style={{ color: 'hsl(35 20% 88%)' }}>
                {data.name}
              </h1>
              {data.character && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'hsl(35 30% 60%)' }}>
                    {data.character.name}
                  </span>
                  <span style={{ color: 'hsl(35 35% 30%)' }}>·</span>
                  <span className="text-xs" style={{ color: 'hsl(35 20% 50%)' }}>
                    {data.character.class ?? 'Adventurer'} · Lv {data.character.level}
                  </span>
                </div>
              )}
            </div>
            {liveSession && (
              <Link href={`/play/${slug}/session`}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-sm"
                style={{ background: 'hsl(35 80% 48% / 0.2)', border: '1px solid hsl(35 80% 48% / 0.4)' }}>
                <Zap className="h-4 w-4" style={{ color: 'hsl(35 80% 65%)' }} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map(action => (
          <Link key={action.label} href={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-sm active:opacity-70 transition-opacity"
            style={{
              background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
              border: '1px solid hsl(35 35% 18%)',
              boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
            }}>
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${iconBg[action.color]}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'hsl(35 10% 52%)' }}>
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Party strip */}
      {(data.members as any[]).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-display text-xs font-bold tracking-wide" style={{ color: 'hsl(35 20% 88%)' }}>
              Your Party
            </span>
            <Link href={`/play/${slug}/characters`} className="text-[11px] font-semibold" style={{ color: 'hsl(35 80% 55%)' }}>
              Manage ›
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(data.members as any[]).map((m: any) => (
              <div key={m.userId} className="shrink-0 min-w-[96px] rounded-sm p-3"
                style={{
                  background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
                  border: '1px solid hsl(35 35% 18%)',
                  borderLeft: '2px solid hsl(35 70% 38%)',
                  boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
                }}>
                <div className={`w-9 h-9 rounded-sm flex items-center justify-center text-sm font-bold mb-2 overflow-hidden ${avatarColor(m.user?.name ?? null)}`}
                  style={{ border: '1px solid hsl(35 50% 28%)' }}>
                  {m.user?.image
                    ? <img src={m.user.image} alt={m.user.name ?? ''} className="w-full h-full object-cover" />
                    : (m.user?.name?.[0]?.toUpperCase() ?? '?')}
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: 'hsl(35 20% 88%)' }}>
                  {m.user?.name ?? 'Unknown'}
                </p>
                <p className="text-[10px] capitalize mt-0.5" style={{ color: 'hsl(35 10% 48%)' }}>
                  {m.role?.toLowerCase().replace('_', ' ') ?? 'member'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {data.sessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-display text-xs font-bold tracking-wide" style={{ color: 'hsl(35 20% 88%)' }}>
              Recent Sessions
            </span>
            <Link href={`/play/${slug}/sessions`} className="text-[11px] font-semibold" style={{ color: 'hsl(35 80% 55%)' }}>
              All ›
            </Link>
          </div>
          <div className="space-y-2">
            {(data.sessions as any[]).slice(0, 3).map((session: any, i: number) => {
              const isLive = session.status === 'in_progress';
              const num = data.sessions.length - i;
              return (
                <Link key={session.id} href={isLive ? `/play/${slug}/session` : `/play/${slug}/sessions/${session.id}`}>
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-sm"
                    style={{
                      background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
                      border: '1px solid hsl(35 35% 18%)',
                      boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
                    }}>
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-sm font-display text-sm font-bold"
                      style={{ background: 'hsl(35 70% 18%)', border: '1px solid hsl(35 60% 32%)', color: 'hsl(35 80% 65%)' }}>
                      {num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'hsl(35 20% 88%)' }}>
                        {session.title ?? `Session ${num}`}
                      </p>
                      {session.date && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'hsl(35 10% 48%)' }}>
                          {new Date(session.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                    {isLive ? (
                      <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                        style={{ background: 'hsl(0 62% 42% / 0.2)', border: '1px solid hsl(0 62% 42% / 0.35)', color: 'hsl(0 80% 70%)' }}>
                        Live
                      </span>
                    ) : session.status === 'completed' ? (
                      <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                        style={{ background: 'hsl(145 50% 40% / 0.15)', border: '1px solid hsl(145 50% 40% / 0.3)', color: 'hsl(145 60% 65%)' }}>
                        Done
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                        style={{ background: 'hsl(35 80% 48% / 0.12)', border: '1px solid hsl(35 80% 48% / 0.25)', color: 'hsl(35 80% 65%)' }}>
                        Draft
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* DM notes */}
      {!liveSession && upcomingSession?.quickNotes && (
        <div className="flex items-start gap-3 rounded-sm px-4 py-3"
          style={{ border: '1px solid hsl(35 35% 18%)', background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}>
          <CalendarDays className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'hsl(35 80% 55%)' }} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'hsl(35 10% 48%)' }}>
              DM Notes
            </p>
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'hsl(35 15% 65%)' }}>
              {upcomingSession.quickNotes}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
