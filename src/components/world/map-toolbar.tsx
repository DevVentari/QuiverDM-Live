'use client';

import { MapPin, StickyNote, Settings, Sparkles, Monitor, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface MapToolbarProps {
  onPlaceLocation: () => void;
  onPlaceNote: () => void;
  onOpenSettings: () => void;
  onToggleFoundry: () => void;
  onToggleDdb: () => void;
  mapId: string;
  campaignId: string;
}

export function MapToolbar({ onPlaceLocation, onPlaceNote, onOpenSettings, onToggleFoundry, onToggleDdb, mapId, campaignId }: MapToolbarProps) {
  const generateMutation = trpc.worldMap.generateMapBackground.useMutation({
    onSuccess: () => toast.info('Map generation queued — background will update when ready'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <TooltipProvider>
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-lg border border-border bg-card/80 p-1 backdrop-blur-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlaceLocation}>
              <MapPin className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Place location</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlaceNote}>
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
              className="h-8 w-8"
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleFoundry}>
              <Monitor className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">FoundryVTT</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleDdb}>
              <Map className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">D&amp;D Beyond VTT</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Map settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
