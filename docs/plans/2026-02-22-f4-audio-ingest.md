# Feature 4: Audio Ingest Everywhere

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Browser-based audio recorder with voice-activity detection that uploads directly to the existing transcription pipeline, plus mobile-friendly upload.

**Architecture:** `useAudioRecorder` hook wraps MediaRecorder + Web Audio API for VAD. `AudioRecorder` component provides record/pause/stop UI with level meter. On stop, blob is uploaded to existing `/api/uploads` endpoint which creates a `SessionRecording` and triggers the BullMQ transcription worker. Mobile: extend the upload UI with `accept="audio/*,video/*"` and camera picker.

**Tech Stack:** Web Audio API, MediaRecorder API, React hooks, tRPC, existing BullMQ transcription worker, shadcn/ui

---

## Task 1: useAudioRecorder Hook

**Files:**
- Create: `src/hooks/useAudioRecorder.ts`

**Step 1: Create hook**

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface UseAudioRecorderReturn {
  state: RecorderState;
  audioBlob: Blob | null;
  audioUrl: string | null;
  durationSeconds: number;
  volumeLevel: number; // 0-100
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

export function useAudioRecorder(vadThreshold = 15): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const measureVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
    setVolumeLevel(Math.round((avg / 255) * 100));
    animFrameRef.current = requestAnimationFrame(measureVolume);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Set up Web Audio analyser for level meter
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        cancelAnimationFrame(animFrameRef.current);
        setVolumeLevel(0);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000); // collect in 1s chunks
      setState('recording');
      startTimeRef.current = Date.now();

      // Duration timer
      timerRef.current = setInterval(() => {
        setDurationSeconds(pausedDurationRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Start volume meter
      measureVolume();
    } catch (err: any) {
      setError(err.message || 'Microphone access denied');
    }
  }, [measureVolume]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      pausedDurationRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDurationSeconds(pausedDurationRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      measureVolume();
    }
  }, [measureVolume]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setState('stopped');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDurationSeconds(0);
    setVolumeLevel(0);
    setError(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
  }, [audioUrl]);

  return { state, audioBlob, audioUrl, durationSeconds, volumeLevel, start, pause, resume, stop, reset, error };
}
```

**Step 2:**
```bash
git add src/hooks/useAudioRecorder.ts
git commit -m "feat(hook): add useAudioRecorder with VAD level meter and MediaRecorder"
```

---

## Task 2: AudioRecorder Component

**Files:**
- Create: `src/components/session/audio-recorder.tsx`

**Step 1: Create component**

```tsx
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
  const { state, audioBlob, audioUrl, durationSeconds, volumeLevel, start, pause, resume, stop, reset, error } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  async function handleUpload() {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('file', audioBlob, `recording-${Date.now()}.${ext}`);
      formData.append('sessionId', sessionId);
      formData.append('campaignId', campaignId);

      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json();
      toast.success('Recording uploaded! Transcription will begin shortly.');
      utils.sessionRecordings.getBySession.invalidate({ sessionId });
      onUploadComplete?.(data.recordingId);
      reset();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${state === 'recording' ? 'bg-red-500 animate-pulse' : state === 'paused' ? 'bg-yellow-500' : 'bg-muted'}`} />
        <span className="text-sm font-medium">
          {state === 'idle' ? 'Ready to record' : state === 'recording' ? 'Recording…' : state === 'paused' ? 'Paused' : 'Recording complete'}
        </span>
        {(state === 'recording' || state === 'paused') && (
          <span className="text-sm font-mono ml-auto">{formatDuration(durationSeconds)}</span>
        )}
      </div>

      {state === 'recording' && (
        <Progress value={volumeLevel} className="h-1" />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {state === 'idle' && (
          <Button onClick={start} size="sm" className="flex-1">
            <Mic className="h-4 w-4 mr-2" /> Start Recording
          </Button>
        )}
        {state === 'recording' && (
          <>
            <Button onClick={pause} size="sm" variant="outline"><Pause className="h-4 w-4" /></Button>
            <Button onClick={stop} size="sm" variant="destructive"><Square className="h-4 w-4 mr-1" /> Stop</Button>
          </>
        )}
        {state === 'paused' && (
          <>
            <Button onClick={resume} size="sm" variant="outline"><Play className="h-4 w-4" /></Button>
            <Button onClick={stop} size="sm" variant="destructive"><Square className="h-4 w-4 mr-1" /> Stop</Button>
          </>
        )}
        {state === 'stopped' && (
          <>
            <Button onClick={reset} size="sm" variant="outline"><RotateCcw className="h-4 w-4 mr-1" /> Discard</Button>
            {audioUrl && <audio src={audioUrl} controls className="flex-1 h-8" />}
            <Button onClick={handleUpload} size="sm" disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4 mr-1" /> Upload &amp; Transcribe</>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2:**
```bash
git add src/components/session/audio-recorder.tsx
git commit -m "feat(component): add AudioRecorder with level meter, pause, upload"
```

---

## Task 3: Wire AudioRecorder into session page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**Step 1:** Import and render (DM only, alongside existing upload UI):

```typescript
import { AudioRecorder } from '@/components/session/audio-recorder';
```

```tsx
{isDM && (
  <AudioRecorder sessionId={sessionId} campaignId={campaignId} />
)}
```

**Step 2:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): wire AudioRecorder into session page for DMs"
```

---

## Task 4: Mobile-friendly upload improvements

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**Step 1:** Find the existing file upload `<Input type="file">` element. Update its `accept` attribute:

```tsx
accept="audio/*,video/*"
capture="environment"
```

The `capture="environment"` attribute on mobile browsers triggers the camera/mic picker. This is a one-line change to the existing file input.

**Step 2:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): add mobile audio/video capture support to upload input"
```

---

## Task 5: Type check

```bash
npx tsc --noEmit
git add -A && git commit -m "feat: Feature 4 — audio ingest everywhere complete"
```
