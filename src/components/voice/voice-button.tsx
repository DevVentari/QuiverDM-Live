'use client';

import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoice } from './voice-provider';
import { cn } from '@/lib/utils';

export function VoiceButton() {
  const { isListening, lastTranscript, lastResponse, startListening, stopListening } = useVoice();
  const hasResponse = !!lastResponse && !isListening;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-full transition-all',
          isListening && 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50 animate-pulse'
        )}
        onClick={isListening ? stopListening : startListening}
        title={isListening ? 'Stop listening' : 'Ask DM Brain (voice)'}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {hasResponse && (
        <div className="absolute top-10 right-0 z-50 w-72 rounded-lg border border-amber-500/30 bg-card p-3 text-xs shadow-xl space-y-2">
          {lastTranscript && (
            <p className="text-muted-foreground italic">"{lastTranscript}"</p>
          )}
          {lastResponse && (
            <p className="leading-relaxed">{lastResponse}</p>
          )}
        </div>
      )}
    </div>
  );
}
