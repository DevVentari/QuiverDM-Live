import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { SessionPrepDataSchema } from '@/lib/prep-types';

const SECTIONS = [
  { id: 'characters',   label: 'Characters' },
  { id: 'strong-start', label: 'Strong Start' },
  { id: 'scenes',       label: 'Scenes' },
  { id: 'secrets',      label: 'Secrets & Clues' },
  { id: 'npcs',         label: 'Featured NPCs' },
  { id: 'monsters',     label: 'Monsters' },
  { id: 'rewards',      label: 'Rewards' },
  { id: 'threads',      label: 'Loose Threads' },
] as const;

export function getCompletedSections(prepData: Record<string, unknown> | null): Set<string> {
  const s = new Set<string>();
  if (!prepData) return s;
  const d = prepData as Record<string, unknown>;
  const notes = d.characterNotes as Array<{ goals?: string; notes?: string }> | undefined;
  if (notes?.some((n) => n.goals || n.notes)) s.add('characters');
  if (d.strongStart) s.add('strong-start');
  if ((d.scenes as unknown[])?.length > 0) s.add('scenes');
  if ((d.secretsAndClues as unknown[])?.length > 0) s.add('secrets');
  if ((d.npcs as unknown[])?.length > 0) s.add('npcs');
  if ((d.monsters as unknown[])?.length > 0) s.add('monsters');
  if ((d.rewards as unknown[])?.length > 0) s.add('rewards');
  if ((d.looseThreads as unknown[])?.length > 0) s.add('threads');
  return s;
}

export function PrepStatusCard({
  session,
  sessionId,
  slug,
}: {
  session: Record<string, unknown>;
  sessionId: string;
  slug: string;
}) {
  const parsed = SessionPrepDataSchema.safeParse(session?.prepData);
  const completed = getCompletedSections(parsed.success ? (parsed.data as Record<string, unknown>) : null);
  const isPrepComplete = (session?.prepStatus as string) === 'complete';
  const count = completed.size;

  return (
    <div
      className="rounded-sm border overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
        borderColor: isPrepComplete ? 'hsl(35 60% 22%)' : 'hsl(240 20% 16%)',
      }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: isPrepComplete ? 'hsl(35 60% 18%)' : 'hsl(240 20% 14%)' }}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(35 80% 55%)' }} />
          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'hsl(35 80% 48%)' }}
          >
            Session Prep
          </span>
        </div>
        {isPrepComplete ? (
          <span
            className="text-[9px] px-2 py-0.5 rounded border uppercase tracking-wide font-semibold"
            style={{ background: 'hsl(35 60% 12%)', color: 'hsl(35 80% 65%)', borderColor: 'hsl(35 60% 25%)' }}
          >
            Prep Complete
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: 'hsl(240 10% 40%)' }}>
            {count}/8 sections
          </span>
        )}
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {SECTIONS.map(({ id, label }) => {
            const done = completed.has(id);
            return (
              <div
                key={id}
                className="px-2 py-1.5 rounded text-center text-[9px] uppercase tracking-wide border"
                style={{
                  background: done ? 'hsl(140 30% 10%)' : 'hsl(240 10% 13%)',
                  color: done ? 'hsl(140 50% 50%)' : 'hsl(240 10% 40%)',
                  borderColor: done ? 'hsl(140 30% 18%)' : 'hsl(240 20% 16%)',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        <Link
          href={`/campaigns/${slug}/sessions/${sessionId}/prep`}
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ color: 'hsl(35 80% 55%)' }}
          data-testid="prep-status-card-cta"
        >
          {isPrepComplete ? 'View Prep' : count === 0 ? 'Start Prep →' : 'Continue Prep →'}
        </Link>
      </div>
    </div>
  );
}
