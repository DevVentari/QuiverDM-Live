'use client';

import { MapPin, StickyNote, Settings, Sparkles, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface MapToolbarProps {
  onPlaceLocation: () => void;
  onPlaceNote: () => void;
  onOpenSettings: () => void;
  slug: string;
  mapId: string;
  campaignId: string;
}

export function MapToolbar({ onPlaceLocation, onPlaceNote, onOpenSettings, slug, mapId, campaignId }: MapToolbarProps) {
  const generateMutation = trpc.worldMap.generateMapBackground.useMutation({
    onSuccess: () => toast.info('Map generation queued — background will update when ready'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <TooltipProvider>
      <div
        className="absolute left-5 top-5 z-20 flex flex-col gap-1 rounded-[1.1rem] border p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md"
        style={{
          borderColor: 'var(--wm-border)',
          background: 'linear-gradient(180deg, var(--wm-raised), var(--wm-surface))',
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:opacity-90"
              style={{ color: 'var(--wm-soft-text)' }}
              onClick={onPlaceLocation}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Place location</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:opacity-90"
              style={{ color: 'var(--wm-soft-text)' }}
              onClick={onPlaceNote}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Place note</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:opacity-90"
              style={{ color: 'var(--wm-soft-text)' }}
              onClick={() => generateMutation.mutate({ mapId, campaignId })}
              disabled={generateMutation.isPending}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Generate map with AI</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:opacity-90"
              style={{ color: 'var(--wm-soft-text)' }}
              onClick={() => window.open(`/campaigns/${slug}/foundry`, '_blank')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Open FoundryVTT</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:opacity-90"
              style={{ color: 'var(--wm-soft-text)' }}
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Map settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
