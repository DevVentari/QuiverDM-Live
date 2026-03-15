'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BookOpen } from 'lucide-react';

const PORTRAIT_COLORS = [
  'from-violet-950 to-violet-900 text-violet-400',
  'from-emerald-950 to-emerald-900 text-emerald-400',
  'from-rose-950 to-rose-900 text-rose-400',
  'from-sky-950 to-sky-900 text-sky-400',
  'from-amber-950 to-amber-900 text-amber-400',
];

function portraitColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return PORTRAIT_COLORS[code % PORTRAIT_COLORS.length];
}

export default function PlayNpcsPage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: npcs } = trpc.play.getSharedNpcs.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Known NPCs</h1>
      {!npcs?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Your DM hasn&apos;t shared any NPCs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {npcs.map(npc => (
            <div key={npc.id} className="stone-card overflow-hidden">
              <div className={`h-14 bg-gradient-to-br ${portraitColor(npc.name)} flex items-center justify-center relative`}>
                {npc.imageUrl
                  ? <img src={npc.imageUrl} alt={npc.name} className="absolute inset-0 w-full h-full object-cover object-top opacity-80" />
                  : <span className="font-display text-3xl font-bold opacity-40">{npc.name[0]}</span>
                }
              </div>
              <div className="p-3">
                <p className="font-medium text-sm">{npc.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {npc.role && <p className="text-xs text-amber-400/80">{npc.role}</p>}
                  {npc.faction && (
                    <span className="text-[10px] border border-white/10 bg-white/5 text-muted-foreground/70 rounded px-1.5 py-0.5">{npc.faction}</span>
                  )}
                </div>
                {npc.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{npc.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
