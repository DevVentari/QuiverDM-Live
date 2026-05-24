'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface RoutesPanelProps {
  campaignId: string;
  sessionId: string;
}

export function RoutesPanel({ campaignId, sessionId }: RoutesPanelProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const routesQuery = trpc.sessionRoutes.list.useQuery({ campaignId, sessionId });
  const setActive = trpc.sessionRoutes.setActive.useMutation({
    onSuccess: () => {
      utils.sessionRoutes.list.invalidate({ campaignId, sessionId });
    },
    onError: () => {
      toast({ title: 'Failed to update route', variant: 'destructive' });
    },
  });

  if (routesQuery.isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading routes...</div>;
  }

  const routes = routesQuery.data ?? [];

  if (routes.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No routes prepared for this session.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {routes.map((route) => (
        <div
          key={route.id}
          className={cn(
            'rounded-md border border-border/40 bg-card/40 p-2.5 space-y-2 transition-colors',
            route.isActive && 'border-amber-500/60 bg-amber-950/20'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium">{route.name}</p>
            <Button
              size="sm"
              variant={route.isActive ? 'default' : 'outline'}
              className="h-6 text-[10px] px-2 shrink-0"
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ campaignId, sessionId, routeId: route.isActive ? null : route.id })}
            >
              {route.isActive ? 'Active' : 'Set active'}
            </Button>
          </div>

          {route.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{route.description}</p>
          )}

          {(route.benefits.length > 0 || route.risks.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {route.benefits.map((b, i) => (
                <Badge key={`b-${i}`} variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-500/40 text-emerald-400">
                  {b}
                </Badge>
              ))}
              {route.risks.map((r, i) => (
                <Badge key={`r-${i}`} variant="outline" className="text-[10px] h-4 px-1.5 border-red-500/40 text-red-400">
                  {r}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
