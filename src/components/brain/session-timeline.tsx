'use client';

import type { WorldEntity, GameSession } from '@prisma/client';

interface AppearanceEntry {
  session: Pick<GameSession, 'id' | 'sessionNumber' | 'title' | 'date'>;
  entity: WorldEntity;
}

interface SessionTimelineProps {
  appearances: AppearanceEntry[];
  sessions: Pick<GameSession, 'id' | 'sessionNumber' | 'title' | 'date'>[];
}

const TYPE_COLORS: Record<string, string> = {
  NPC: 'bg-amber-400',
  PC: 'bg-emerald-400',
  FACTION: 'bg-violet-400',
  LOCATION: 'bg-sky-400',
  ITEM: 'bg-orange-400',
  EVENT: 'bg-rose-400',
  ARC: 'bg-indigo-400',
  THREAT: 'bg-red-500',
  SECRET: 'bg-yellow-300',
  CUSTOM: 'bg-zinc-400',
};

export function SessionTimeline({ appearances, sessions }: SessionTimelineProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No sessions recorded yet.</p>
    );
  }

  const appearancesBySession = new Map<string, WorldEntity[]>();
  for (const a of appearances) {
    const list = appearancesBySession.get(a.session.id) ?? [];
    list.push(a.entity);
    appearancesBySession.set(a.session.id, list);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-2">
        {sessions.map((session) => {
          const sessionEntities = appearancesBySession.get(session.id) ?? [];
          return (
            <div key={session.id} className="flex flex-col items-center gap-2 min-w-[100px]">
              <div className="text-center">
                <div className="text-xs font-mono text-primary">S{session.sessionNumber}</div>
                {session.title && (
                  <div className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={session.title}>
                    {session.title}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {new Date(session.date).toLocaleDateString()}
                </div>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex flex-col gap-1">
                {sessionEntities.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/50 italic">—</span>
                ) : (
                  sessionEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded-sm text-black font-medium truncate max-w-[96px] ${TYPE_COLORS[entity.type] ?? TYPE_COLORS.CUSTOM}`}
                      title={`${entity.name} (${entity.type})`}
                    >
                      {entity.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
