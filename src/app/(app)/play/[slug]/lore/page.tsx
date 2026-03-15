'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Wand2 } from 'lucide-react';

export default function PlayLorePage() {
  const { slug } = useParams<{ slug: string }>();
  const hub = trpc.play.getCampaignHub.useQuery({ slug });
  const campaignId = hub.data?.id;
  const { data: lore } = trpc.play.getSharedLore.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Shared Lore</h1>
      {!lore?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Your DM hasn&apos;t shared any lore yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lore.map(item => (
            <div key={item.id} className="stone-card p-4 flex gap-3">
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded object-cover shrink-0" />}
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground capitalize mb-1">{item.type}</p>
                {!!(item.data as Record<string, unknown>)?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
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
