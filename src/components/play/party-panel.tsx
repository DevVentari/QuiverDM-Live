interface PartyMember {
  userId: string;
  role: string;
  user: { id: string; name: string | null; image: string | null };
}
export function PartyPanel({ members }: { members: PartyMember[] }) {
  return (
    <div className="stone-card p-4">
      <p className="overline-label mb-3">Party</p>
      <div className="flex flex-wrap gap-3">
        {members.map(m => (
          <div key={m.userId} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/20">
              {m.user.image
                ? <img src={m.user.image} alt={m.user.name ?? ''} className="h-full w-full object-cover" />
                : <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">{m.user.name?.[0]}</div>
              }
            </div>
            <div>
              <p className="text-sm font-medium leading-none">{m.user.name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{m.role.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
