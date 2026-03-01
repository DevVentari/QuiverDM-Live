'use client';

import { SessionTimer } from './session-timer';
import { PendingEventsQueue } from './pending-events-queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Swords, Mic, MicOff, X } from 'lucide-react';

interface CockpitHeaderProps {
  sessionTitle: string;
  sessionNumber: number;
  isRecording: boolean;
  mode: 'rp' | 'combat';
  onModeToggle: () => void;
  onEndSession: () => void;
  onToggleRecording: () => void;
  sessionId: string;
  campaignId: string;
}

export function CockpitHeader({
  sessionTitle,
  sessionNumber,
  isRecording,
  mode,
  onModeToggle,
  onEndSession,
  onToggleRecording,
  sessionId,
  campaignId,
}: CockpitHeaderProps) {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-display font-bold text-sm text-foreground truncate">
          {sessionTitle}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0 py-0">
          #{sessionNumber}
        </Badge>
      </div>

      <div className="flex-1" />

      <SessionTimer />

      {isRecording && (
        <div className="flex items-center gap-1 text-red-400 text-xs">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>REC</span>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleRecording}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs transition-colors"
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </button>

      <PendingEventsQueue campaignId={campaignId} sessionId={sessionId} />

      <button
        type="button"
        onClick={onModeToggle}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          mode === 'combat'
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
      >
        <Swords className="h-3.5 w-3.5" />
        {mode === 'combat' ? 'Combat' : 'RP'}
      </button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onEndSession}
        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      >
        <X className="h-3.5 w-3.5" />
        End Session
      </Button>
    </header>
  );
}
