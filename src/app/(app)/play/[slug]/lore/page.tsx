'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Wand2 } from 'lucide-react';

export default function PlayLorePage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: lore, isLoading } = trpc.play.getSharedLore.useQuery(
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
          Shared Lore
        </h1>
      </div>

      {isLoading || hub.isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-[76px] bg-white/5 rounded-sm" />)}
        </div>
      ) : !lore?.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center"
            style={{ background: 'hsl(145 40% 10%)', border: '1px solid hsl(145 40% 18%)' }}>
            <Wand2 className="h-5 w-5" style={{ color: 'hsl(145 55% 50%)' }} />
          </div>
          <p className="text-sm text-center" style={{ color: 'hsl(35 10% 40%)' }}>
            Your DM hasn&apos;t shared any lore yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lore.map(item => (
            <div key={item.id} className="flex gap-3 px-3.5 py-3 rounded-sm"
              style={{
                background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
                border: '1px solid hsl(35 35% 18%)',
                borderLeft: '2px solid hsl(145 50% 32%)',
                boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
              }}>
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name}
                  className="h-12 w-12 rounded-sm object-cover shrink-0"
                  style={{ border: '1px solid hsl(35 35% 18%)' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>{item.name}</p>
                <p className="text-[10px] capitalize mt-0.5" style={{ color: 'hsl(145 55% 45%)' }}>{item.type}</p>
                {!!(item.data as Record<string, unknown>)?.description && (
                  <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: 'hsl(35 10% 45%)' }}>
                    {String((item.data as Record<string, unknown>).description)}
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
