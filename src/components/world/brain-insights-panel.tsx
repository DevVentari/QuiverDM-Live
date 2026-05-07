interface SessionAppearance {
  session: { id: string; sessionNumber: number; title: string | null } | null;
}
interface BrainEntity {
  confidence: number;
  sessionAppearances: SessionAppearance[];
}

export function BrainInsightsPanel({ entity }: { entity: BrainEntity }) {
  const sessions = entity.sessionAppearances
    .map((a) => a.session)
    .filter((s): s is NonNullable<typeof s> => s != null);

  return (
    <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-md p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-amber-400/60">Brain Insights</p>
      {sessions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sessions.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 text-[10px] bg-white/[0.04] border border-border/30 rounded px-2 py-0.5 text-muted-foreground"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              Session {s.sessionNumber}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/50">Not yet mentioned in sessions</p>
      )}
      <p className="text-[10px] text-muted-foreground/40">
        Confidence: {Math.round(entity.confidence * 100)}%
      </p>
    </div>
  );
}
