'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface OocReviewItem {
  index: number;
  speaker: string;
  text: string;
  start_formatted: string;
  classification: 'ooc' | 'uncertain';
  confidence: number;
  reason: string;
}

interface OocReviewSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  campaignId: string;
  items: OocReviewItem[];
}

export function OocReviewSheet({ open, onClose, sessionId, campaignId, items }: OocReviewSheetProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [dropped, setDropped] = useState<Set<number>>(new Set());

  const confirmReview = trpc.sessions.confirmOocReview.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      toast({ title: 'Review saved', description: 'Transcript updated.' });
      onClose();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  function toggle(index: number) {
    setDropped(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="font-display text-base">
            Review Flagged Lines — {items.length} uncertain
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Lines the AI flagged as possibly out-of-character. Keep or drop each one.
          </p>
        </SheetHeader>

        <div className="py-4 space-y-3">
          {items.map(item => {
            const isDrop = dropped.has(item.index);
            return (
              <div
                key={item.index}
                className="rounded-sm p-3 space-y-2 transition-opacity"
                style={{
                  background: isDrop ? 'hsl(0 60% 15% / 0.3)' : 'hsl(240 10% 8% / 0.6)',
                  border: `1px solid ${isDrop ? 'hsl(0 60% 35% / 0.3)' : 'hsl(35 35% 15%)'}`,
                  opacity: isDrop ? 0.6 : 1,
                }}
              >
                <p className="text-sm" style={{ color: 'hsl(35 15% 80%)' }}>
                  <span style={{ color: 'hsl(35 80% 55%)' }}>[{item.start_formatted}] {item.speaker}:</span>{' '}
                  {item.text}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  {item.classification} — {item.reason} ({Math.round(item.confidence * 100)}%)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!isDrop ? 'default' : 'outline'}
                    className="h-6 text-xs px-3"
                    onClick={() => { if (isDrop) toggle(item.index); }}
                  >
                    Keep
                  </Button>
                  <Button
                    size="sm"
                    variant={isDrop ? 'destructive' : 'outline'}
                    className="h-6 text-xs px-3"
                    onClick={() => { if (!isDrop) toggle(item.index); }}
                  >
                    Drop
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 pt-4 border-t border-border bg-background/80 backdrop-blur-sm">
          <Button
            className="w-full"
            disabled={confirmReview.isPending}
            onClick={() => confirmReview.mutate({ sessionId, campaignId, drops: Array.from(dropped) })}
          >
            {confirmReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Review ({dropped.size} line{dropped.size !== 1 ? 's' : ''} dropped)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
