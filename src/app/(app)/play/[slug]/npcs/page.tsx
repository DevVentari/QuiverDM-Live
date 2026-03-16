'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BookOpen } from 'lucide-react';

const PORTRAIT_COLORS = [
  'hsl(260 50% 18%)',
  'hsl(145 40% 12%)',
  'hsl(0 40% 14%)',
  'hsl(210 50% 16%)',
  'hsl(35 60% 16%)',
];

function portraitBg(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return PORTRAIT_COLORS[code % PORTRAIT_COLORS.length];
}

export default function PlayNpcsPage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: npcs, isLoading } = trpc.play.getSharedNpcs.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  return (
    <div className="pb-20 px-5 pt-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'hsl(35 80% 48%)' }}>
          Campaign
        </p>
        <h1 className="font-display text-lg font-bold" style={{ color: 'hsl(35 20% 88%)' }}>
          Known NPCs
        </h1>
      </div>

      {isLoading || hub.isLoading ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-[140px] bg-white/5 rounded-sm" />)}
        </div>
      ) : !npcs?.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center"
            style={{ background: 'hsl(210 50% 12%)', border: '1px solid hsl(210 50% 20%)' }}>
            <BookOpen className="h-5 w-5" style={{ color: 'hsl(210 60% 55%)' }} />
          </div>
          <p className="text-sm text-center" style={{ color: 'hsl(35 10% 40%)' }}>
            Your DM hasn&apos;t shared any NPCs yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {npcs.map(npc => (
            <div key={npc.id} className="rounded-sm overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
                border: '1px solid hsl(35 35% 18%)',
                boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
              }}>
              <div className="h-[80px] relative flex items-center justify-center"
                style={{ background: portraitBg(npc.name) }}>
                {npc.imageUrl
                  ? <img src={npc.imageUrl} alt={npc.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                  : <span className="font-display text-4xl font-bold" style={{ color: 'hsl(35 20% 88% / 0.2)' }}>
                      {npc.name[0]}
                    </span>
                }
              </div>
              <div className="p-2.5">
                <p className="text-sm font-semibold truncate" style={{ color: 'hsl(35 20% 88%)' }}>{npc.name}</p>
                {npc.role && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'hsl(35 80% 55%)' }}>{npc.role}</p>
                )}
                {npc.faction && (
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-sm"
                    style={{ background: 'hsl(35 35% 14%)', border: '1px solid hsl(35 35% 22%)', color: 'hsl(35 15% 55%)' }}>
                    {npc.faction}
                  </span>
                )}
                {npc.description && (
                  <p className="text-[10px] mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'hsl(35 10% 45%)' }}>
                    {npc.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
