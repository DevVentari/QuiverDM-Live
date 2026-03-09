'use client';

import { useState } from 'react';
import { useLiveTranscription } from '@/hooks/useLiveTranscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Mic, Radio, Square } from 'lucide-react';

interface LiveTranscriptionControlsProps {
  sessionId: string;
  isDM: boolean;
  onTranscriptSaved?: () => void;
}

function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LiveTranscriptionControls({
  sessionId,
  isDM,
  onTranscriptSaved,
}: LiveTranscriptionControlsProps) {
  const {
    isRecording,
    currentText,
    segments,
    error,
    durationSeconds,
    start,
    stop,
  } = useLiveTranscription(sessionId);

  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      await start();
    } catch {
      // Error is set in the hook
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      const result = await stop();
      if (result.transcriptId && onTranscriptSaved) {
        onTranscriptSaved();
      }
    } catch {
      // Error is set in the hook
    } finally {
      setStopping(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live Transcription
            {isRecording && (
              <Badge variant="destructive" className="text-[10px] animate-pulse">
                LIVE
              </Badge>
            )}
          </CardTitle>

          {isDM && (
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  size="sm"
                  variant="default"
                  disabled={starting || isRecording}
                  onClick={handleStart}
                >
                  {starting ? (
                    <Mic className="mr-1 h-3 w-3 animate-pulse" />
                  ) : (
                    <Mic className="mr-1 h-3 w-3" />
                  )}
                  {starting ? 'Starting...' : 'Start Live Transcription'}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    {formatElapsed(durationSeconds)}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={stopping}
                    onClick={handleStop}
                  >
                    <Square className="mr-1 h-3 w-3" />
                    {stopping ? 'Stopping...' : 'Stop'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-3">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {!isRecording && segments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isDM
              ? 'Start live transcription to capture your session in real time.'
              : 'Live transcription is not active. The DM can start it during the session.'}
          </p>
        )}

        {(isRecording || segments.length > 0) && (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1.5 text-sm">
              {segments.map((seg, idx) => (
                <div key={idx} className="flex gap-2">
                  {seg.speaker && (
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                      {seg.speaker}
                    </Badge>
                  )}
                  <span className="text-foreground/90">{seg.text}</span>
                </div>
              ))}
              {currentText && (
                <div className="flex gap-2 text-muted-foreground italic">
                  <span>{currentText}</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
