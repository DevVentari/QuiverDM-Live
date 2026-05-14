'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';
import { Map, Brain, User } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface LocationPanelProps {
  entityId: string;
  entityName: string;
  campaignId: string;
  mapId: string;
  slug: string;
  onClose: () => void;
}

export function LocationPanel({ entityId, entityName, campaignId, mapId, slug, onClose }: LocationPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState('');

  const eventsQuery = trpc.worldMap.getLocationEvents.useQuery({ entityId, campaignId });
  const addNoteMutation = trpc.worldMap.addLocationNote.useMutation({
    onSuccess: () => {
      setNote('');
      void eventsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const createSubMapMutation = trpc.worldMap.createSubMap.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${slug}/world-map?map=${data.id}`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const events = eventsQuery.data ?? [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[380px] overflow-y-auto border-l border-border bg-card p-0">
        <SheetHeader className="border-b border-amber-500/10 bg-[linear-gradient(180deg,hsl(240_14%_12%/.96),hsl(240_12%_8%/.98))] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/55">Location Chronicle</p>
          <SheetTitle className="mt-2 font-display text-base text-amber-50">{entityName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 bg-[linear-gradient(180deg,hsl(238_15%_10%),hsl(240_12%_7%))] p-5">
          {/* Event timeline */}
          <div className="flex flex-col gap-3">
            {events.length === 0 && (
              <p className="text-sm text-amber-100/55">No events yet. Add a note or play a session to see history gather around this place.</p>
            )}
            {events.map((event) => {
              const isBrain = event.source === 'ingestion' || event.source === 'inference';
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    {isBrain
                      ? <Brain className="h-3 w-3 text-[hsl(258_60%_65%)]" />
                      : <User className="h-3 w-3 text-primary" />
                    }
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm leading-snug text-amber-50/90">
                      {typeof event.newValue === 'object' && event.newValue !== null
                        ? (event.newValue as any).content ?? JSON.stringify(event.newValue)
                        : String(event.newValue)}
                    </p>
                    <div className="flex items-center gap-2">
                      {event.session && (
                        <Badge variant="outline" className="h-4 border-amber-500/20 bg-amber-500/[0.05] px-1 text-[10px] text-amber-100/70">
                          {event.session.title ?? `Session ${event.session.sessionNumber}`}
                        </Badge>
                      )}
                      <span className="text-[11px] text-amber-100/45">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Add note */}
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Add a note about this location…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] resize-none border-amber-500/15 bg-white/[0.03] text-sm text-amber-50 placeholder:text-amber-100/30"
            />
            <Button
              size="sm"
              disabled={!note.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate({ entityId, campaignId, content: note.trim() })}
            >
              Add note
            </Button>
          </div>

          <Separator />

          {/* Sub-map */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-amber-500/20 bg-amber-500/[0.04] text-amber-100 hover:bg-amber-500/[0.08]"
            disabled={createSubMapMutation.isPending}
            onClick={() => createSubMapMutation.mutate({ parentLocationEntityId: entityId, campaignId, name: 'Location Map' })}
          >
            <Map className="h-4 w-4" />
            Open sub-map
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
