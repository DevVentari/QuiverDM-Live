'use client';

import { useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Mic, Pause, Square, Play, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface AudioRecorderProps {
  sessionId: string;
  campaignId: string;
  onUploadComplete?: (recordingId: string) => void;
}

export function AudioRecorder({ sessionId, campaignId, onUploadComplete }: AudioRecorderProps) {
  const { state, audioBlob, audioUrl, durationSeconds, volumeLevel, start, pause, resume, stop, reset, error } =
    useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const createRecording = trpc.sessionRecordings.create.useMutation();

  async function handleUpload() {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      const filename = `recording-${Date.now()}.${ext}`;
      const contentType = audioBlob.type;
      let recordingUrl: string;

      if (process.env.NEXT_PUBLIC_STORAGE_MODE === 'r2') {
        // R2: get presigned upload URL, PUT directly to R2, then register in DB
        const res = await fetch('/api/recordings/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, filename, contentType, fileSize: audioBlob.size }),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
        const r2Res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: audioBlob });
        if (!r2Res.ok) throw new Error('Upload to storage failed');
        recordingUrl = `/api/storage/${key}`;
      } else {
        // Local: POST FormData directly to API
        const formData = new FormData();
        formData.append('file', audioBlob, filename);
        formData.append('sessionId', sessionId);
        const res = await fetch('/api/recordings/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const data = (await res.json()) as { url: string };
        recordingUrl = data.url;
      }

      const recording = await createRecording.mutateAsync({
        sessionId,
        type: 'audio',
        url: recordingUrl,
        fileSize: audioBlob.size,
      });
      toast.success('Recording uploaded. Transcription will begin shortly.');
      void utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
      onUploadComplete?.(recording.id);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            state === 'recording'
              ? 'bg-red-500 animate-pulse'
              : state === 'paused'
                ? 'bg-yellow-500'
                : 'bg-muted'
          }`}
        />
        <span className="text-sm font-medium">
          {state === 'idle'
            ? 'Ready to record'
            : state === 'recording'
              ? 'Recording...'
              : state === 'paused'
                ? 'Paused'
                : 'Recording complete'}
        </span>
        {(state === 'recording' || state === 'paused') && (
          <span className="text-sm font-mono ml-auto">{formatDuration(durationSeconds)}</span>
        )}
      </div>

      {state === 'recording' && <Progress value={volumeLevel} className="h-1" />}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        {state === 'idle' && (
          <Button onClick={start} size="sm" className="flex-1">
            <Mic className="h-4 w-4 mr-2" /> Start Recording
          </Button>
        )}
        {state === 'recording' && (
          <>
            <Button onClick={pause} size="sm" variant="outline">
              <Pause className="h-4 w-4" />
            </Button>
            <Button onClick={stop} size="sm" variant="destructive">
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          </>
        )}
        {state === 'paused' && (
          <>
            <Button onClick={resume} size="sm" variant="outline">
              <Play className="h-4 w-4" />
            </Button>
            <Button onClick={stop} size="sm" variant="destructive">
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          </>
        )}
        {state === 'stopped' && (
          <>
            <Button onClick={reset} size="sm" variant="outline">
              <RotateCcw className="h-4 w-4 mr-1" /> Discard
            </Button>
            {audioUrl && <audio src={audioUrl} controls className="flex-1 min-w-[220px] h-8" />}
            <Button onClick={handleUpload} size="sm" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Upload &amp; Transcribe
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
