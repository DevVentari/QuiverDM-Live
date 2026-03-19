'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props { sourcebookId: string; onClose: () => void; }

function StatusBadge({ status }: { status: string }) {
  if (status === 'idle') return <Badge className="text-xs bg-green-900/50 text-green-300">Synced</Badge>;
  if (status === 'running') return <Badge className="text-xs bg-amber-900/50 text-amber-300">Syncing...</Badge>;
  if (status === 'error') return <Badge variant="destructive" className="text-xs">Error</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export function DdbSourcebookDrawer({ sourcebookId, onClose }: Props) {
  const { data: sourcebook, refetch } = trpc.ddbSync.getSourcebook.useQuery({ sourcebookId });
  const syncMutation = trpc.ddbSync.syncNow.useMutation({ onSuccess: () => refetch() });
  const resolveMutation = trpc.ddbSync.resolveChange.useMutation({ onSuccess: () => refetch() });
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  if (!sourcebook) return null;

  const toggle = (id: string) => setExpandedChapters(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-amber-400">{sourcebook.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <StatusBadge status={sourcebook.syncStatus} />
              {sourcebook.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced {formatDistanceToNow(new Date(sourcebook.lastSyncedAt))} ago
                </p>
              )}
              {sourcebook.lastSyncError === 'auth' && (
                <p className="text-xs text-destructive">Session expired — update CobaltSession in settings</p>
              )}
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => syncMutation.mutate({ sourcebookId })}
              disabled={syncMutation.isPending || sourcebook.syncStatus === 'running'}
            >
              {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Sync Now</span>
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-cinzel tracking-widest text-muted-foreground uppercase">Chapters</h3>
            {sourcebook.chapters.map(ch => (
              <div key={ch.id} className="border border-border rounded-md overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => ch.hasPendingChanges && toggle(ch.id)}
                >
                  <div className="flex items-center gap-3">
                    {ch.hasPendingChanges
                      ? expandedChapters.has(ch.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      : <div className="w-4" />}
                    <span className="text-sm">{ch.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ch.hasPendingChanges && <Badge className="text-xs bg-orange-900/50 text-orange-300">Changes</Badge>}
                    <StatusBadge status={ch.syncStatus} />
                  </div>
                </button>

                {ch.hasPendingChanges && expandedChapters.has(ch.id) && (
                  <div className="border-t border-border p-3 space-y-4 bg-muted/20">
                    {((ch.pendingChanges ?? []) as any[]).map((change, i) => (
                      <div key={`${change.entityId}-${change.field}`} className="space-y-2 text-sm">
                        <p className="font-medium">{change.entityName} — {change.field}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-red-950/30 rounded p-2">
                            <p className="text-muted-foreground mb-1">Current</p>
                            <p>{String(change.oldValue)}</p>
                          </div>
                          <div className="bg-green-950/30 rounded p-2">
                            <p className="text-muted-foreground mb-1">DDB Update</p>
                            <p>{String(change.newValue)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline"
                            onClick={() => resolveMutation.mutate({
                              chapterId: ch.id, entityId: change.entityId, entityType: change.entityType,
                              field: change.field, action: 'accept', newValue: change.newValue,
                            })}>Accept DDB version</Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => resolveMutation.mutate({
                              chapterId: ch.id, entityId: change.entityId, entityType: change.entityType,
                              field: change.field, action: 'keep',
                            })}>Keep mine</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
