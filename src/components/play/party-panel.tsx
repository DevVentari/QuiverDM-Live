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
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

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
            <div className={`h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/15 flex items-center justify-center text-xs font-bold ${avatarColor(m.user.name)}`}>
              {m.user.image
                ? <img src={m.user.image} alt={m.user.name ?? ''} className="h-full w-full object-cover" />
                : (m.user.name?.[0] ?? '?')}
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
