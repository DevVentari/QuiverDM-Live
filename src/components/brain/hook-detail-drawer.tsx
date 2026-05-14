'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type Hook = {
  id: string;
  text: string;
  urgency: 'low' | 'medium' | 'high';
  status?: string;
  ageInSessions?: number;
  linkedEntityNames?: string[];
  createdSessionId?: string | null;
};

interface HookDetailDrawerProps {
  hook: Hook;
  campaignId: string;
  campaignSlug: string;
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

const urgencyStyles = {
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  medium: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  low: 'bg-muted/40 text-muted-foreground border-border',
} as const;

export function HookDetailDrawer({
  hook,
  campaignId,
  campaignSlug,
  open,
  onClose,
  onMutated,
}: HookDetailDrawerProps) {
  const [reason, setReason] = useState('');

  const resolveMutation = trpc.brain.hooks.resolve.useMutation({
    onSuccess: () => {
      toast.success('Hook resolved.');
      setReason('');
      onMutated();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const escalateMutation = trpc.brain.hooks.escalate.useMutation({
    onSuccess: () => {
      toast.success('Hook escalated.');
      onMutated();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const reopenMutation = trpc.brain.hooks.reopen.useMutation({
    onSuccess: () => {
      toast.success('Hook reopened.');
      setReason('');
      onMutated();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const isResolved = hook.status === 'resolved';
  const isPending = resolveMutation.isPending || escalateMutation.isPending || reopenMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md space-y-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold leading-snug">Hook Detail</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-5">
          <div className="flex items-start gap-3">
            <Badge
              variant="outline"
              className={cn('mt-0.5 shrink-0 text-[10px] uppercase tracking-wider', urgencyStyles[hook.urgency])}
            >
              {hook.urgency}
            </Badge>
            {isResolved && (
              <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                Resolved
              </Badge>
            )}
          </div>

          <p className="text-sm leading-relaxed">{hook.text}</p>

          {hook.ageInSessions !== undefined && hook.ageInSessions > 0 && (
            <p className="text-xs text-muted-foreground">
              Open for {hook.ageInSessions} session{hook.ageInSessions !== 1 ? 's' : ''}
            </p>
          )}

          {hook.linkedEntityNames && hook.linkedEntityNames.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Entities</p>
              <div className="flex flex-wrap gap-1.5">
                {hook.linkedEntityNames.map((name) => (
                  <Badge key={name} variant="outline" className="text-xs cursor-default">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="section-rule" />

          {!isResolved && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason (required to resolve or reopen)</Label>
                <Textarea
                  placeholder="Describe how this hook was resolved or why it's being changed..."
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {reason.length > 0 && reason.length < 10 && (
                  <p className="text-[10px] text-muted-foreground">Minimum 10 characters ({reason.length}/10)</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={isPending || reason.length < 10}
                  onClick={() => resolveMutation.mutate({ campaignId, hookId: hook.id, reason })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending || hook.urgency === 'high'}
                  onClick={() => escalateMutation.mutate({ campaignId, hookId: hook.id })}
                >
                  Escalate
                </Button>
              </div>
            </div>
          )}

          {isResolved && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason to reopen</Label>
                <Textarea
                  placeholder="Why is this hook being reopened?"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {reason.length > 0 && reason.length < 10 && (
                  <p className="text-[10px] text-muted-foreground">Minimum 10 characters ({reason.length}/10)</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || reason.length < 10}
                onClick={() => reopenMutation.mutate({ campaignId, hookId: hook.id, reason })}
              >
                Reopen
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
