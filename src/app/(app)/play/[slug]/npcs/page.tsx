'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BookOpen } from 'lucide-react';

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
          <p>Your DM hasn't shared any NPCs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {npcs.map(npc => (
            <div key={npc.id} className="stone-card p-3 flex gap-3">
              {npc.imageUrl && <img src={npc.imageUrl} alt={npc.name} className="h-12 w-12 rounded object-cover shrink-0" />}
              <div>
                <p className="font-medium text-sm">{npc.name}</p>
                {npc.role && <p className="text-xs text-muted-foreground">{npc.role}</p>}
                {npc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{npc.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
