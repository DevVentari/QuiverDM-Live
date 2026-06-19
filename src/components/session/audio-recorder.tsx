'use client';

import { useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { QdButton, QdProgress } from '@/components/ui-v3';
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
    <div className="border-qd-faint rounded-qd-lg p-4 space-y-3 border">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            state === 'recording'
              ? 'bg-qd-danger animate-pulse'
              : state === 'paused'
                ? 'bg-qd-warn'
                : 'bg-qd-border'
          }`}
        />
        <span className="text-qd-body-sm text-qd-ink-strong">
          {state === 'idle'
            ? 'Ready to record'
            : state === 'recording'
              ? 'Recording...'
              : state === 'paused'
                ? 'Paused'
                : 'Recording complete'}
        </span>
        {(state === 'recording' || state === 'paused') && (
          <span className="font-qd-mono text-[11px] text-qd-ink ml-auto">{formatDuration(durationSeconds)}</span>
        )}
      </div>

      {state === 'recording' && <QdProgress value={volumeLevel} />}

      {error && <p className="text-qd-body-sm text-qd-danger">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        {state === 'idle' && (
          <QdButton onClick={start} variant="primary" className="flex-1">
            <Mic className="h-4 w-4" /> Start Recording
          </QdButton>
        )}
        {state === 'recording' && (
          <>
            <QdButton onClick={pause} variant="outline">
              <Pause className="h-4 w-4" />
            </QdButton>
            <QdButton onClick={stop} variant="danger">
              <Square className="h-4 w-4" /> Stop
            </QdButton>
          </>
        )}
        {state === 'paused' && (
          <>
            <QdButton onClick={resume} variant="outline">
              <Play className="h-4 w-4" />
            </QdButton>
            <QdButton onClick={stop} variant="danger">
              <Square className="h-4 w-4" /> Stop
            </QdButton>
          </>
        )}
        {state === 'stopped' && (
          <>
            <QdButton onClick={reset} variant="outline">
              <RotateCcw className="h-4 w-4" /> Discard
            </QdButton>
            {audioUrl && <audio src={audioUrl} controls className="flex-1 min-w-[220px] h-8" />}
            <QdButton onClick={handleUpload} variant="primary" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload &amp; Transcribe
                </>
              )}
            </QdButton>
          </>
        )}
      </div>
    </div>
  );
}
