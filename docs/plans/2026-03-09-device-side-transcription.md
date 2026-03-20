# Device-Side Transcription (Web Speech API) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the AssemblyAI WebSocket streaming pipeline with browser-native Web Speech API, eliminating all server-side transcription COGS for live sessions.

**Architecture:** The browser's built-in speech recognition (Web Speech API) processes audio locally — no audio bytes sent to our server. On stop, the collected text segments are saved via a single tRPC mutation. The existing AssemblyAI async path (file upload → WhisperX worker) remains untouched as an optional post-session feature.

**Tech Stack:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), tRPC, Prisma `Transcript` model (source `'web_speech'`)

---

### Task 1: Rewrite `useLiveTranscription` hook (Web Speech API)

**Files:**
- Modify: `src/hooks/useLiveTranscription.ts`

Keep the same exported interface so consumers (`cockpit/page.tsx`, `live-transcription-controls.tsx`) need zero changes:

```
isConnected, isRecording, currentText, segments, error, durationSeconds, dmHints, start, stop
```

`isConnected` → always `true` when recording (no WS concept)
`dmHints` → always `[]` (feature removed for now)

**Step 1: Replace the entire hook implementation**

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { track, EVENTS } from '@/lib/analytics';

interface LiveTranscriptSegment {
  text: string;
  isFinal: boolean;
  speaker?: string;
  timestamp: number;
}

export interface DmHint {
  text: string;
  priority: 'info' | 'important';
  effectName?: string;
  receivedAt: number;
}

interface UseLiveTranscriptionReturn {
  isConnected: boolean;
  isRecording: boolean;
  currentText: string;
  segments: LiveTranscriptSegment[];
  error: string | null;
  durationSeconds: number;
  dmHints: DmHint[];
  start: () => Promise<void>;
  stop: () => Promise<{ transcriptId: string | null }>;
}

export function useLiveTranscription(sessionId: string): UseLiveTranscriptionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [segments, setSegments] = useState<LiveTranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const segmentsRef = useRef<LiveTranscriptSegment[]>([]);

  const saveMutation = trpc.sessionTranscription.saveWebSpeechTranscript.useMutation();

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setCurrentText('');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSegments([]);
    setCurrentText('');
    setDurationSeconds(0);
    segmentsRef.current = [];

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Live transcription requires Chrome or Edge. Try uploading a recording instead.');
      throw new Error('SpeechRecognition not supported');
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const segment: LiveTranscriptSegment = {
            text: result[0].transcript.trim(),
            isFinal: true,
            timestamp: Date.now(),
          };
          segmentsRef.current = [...segmentsRef.current, segment];
          setSegments([...segmentsRef.current]);
          setCurrentText('');
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setCurrentText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' is a normal pause — don't treat as fatal
      if (event.error === 'no-speech') return;
      setError(`Transcription error: ${event.error}`);
      cleanup();
    };

    recognition.onend = () => {
      // Auto-restart if still recording (browser stops after silence)
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ignore */ }
      }
    };

    recognition.start();

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDurationSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    setIsRecording(true);
    track(EVENTS.TRANSCRIPTION_STARTED, { session_id: sessionId });
  }, [sessionId, cleanup]);

  const stop = useCallback(async (): Promise<{ transcriptId: string | null }> => {
    // Stop onend auto-restart by clearing the ref before calling stop()
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch { /* ignore */ }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setCurrentText('');

    const captured = segmentsRef.current;
    if (captured.length === 0) return { transcriptId: null };

    try {
      const result = await saveMutation.mutateAsync({
        sessionId,
        segments: captured.map((s) => ({ text: s.text, timestamp: s.timestamp })),
        durationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      });
      return { transcriptId: result.transcriptId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save transcript';
      setError(msg);
      return { transcriptId: null };
    }
  }, [sessionId, saveMutation]);

  return {
    isConnected: isRecording,
    isRecording,
    currentText,
    segments,
    error,
    durationSeconds,
    dmHints: [],
    start,
    stop,
  };
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "useLiveTranscription"
```

Expected: no errors for this file.

**Step 3: Commit**

```bash
git add src/hooks/useLiveTranscription.ts
git commit -m "refactor(transcription): replace AssemblyAI WebSocket with Web Speech API"
```

---

### Task 2: Add `saveWebSpeechTranscript` tRPC mutation

**Files:**
- Modify: `src/server/routers/session-transcription.ts`

**Step 1: Add the new mutation at the end of the router, before the closing `})`**

```typescript
saveWebSpeechTranscript: protectedProcedure
  .input(
    z.object({
      sessionId: z.string(),
      segments: z.array(
        z.object({
          text: z.string(),
          timestamp: z.number(),
        })
      ),
      durationSeconds: z.number().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;
    const access = await authz.session(input.sessionId, userId).verify();
    if (!access.isDM) {
      throw new ForbiddenError('Only DMs can save transcripts');
    }

    const rawText = input.segments.map((s) => s.text).join(' ');
    if (!rawText.trim()) {
      return { transcriptId: null };
    }

    const transcript = await prisma.transcript.create({
      data: {
        sessionId: input.sessionId,
        rawText,
        source: 'web_speech',
        durationSeconds: input.durationSeconds ?? null,
        hasSpeakers: false,
        timestamps: input.segments.map((s, i) => ({
          index: i,
          text: s.text,
          timestamp: s.timestamp,
        })),
      },
    });

    return { transcriptId: transcript.id };
  }),
```

**Step 2: Remove the three dead live-session endpoints** (no longer called by anything):
- `startLiveTranscription`
- `stopLiveTranscription`
- `getLiveTranscriptionStatus`

Delete those three procedure blocks from `session-transcription.ts`.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "session-transcription"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/server/routers/session-transcription.ts
git commit -m "feat(transcription): add saveWebSpeechTranscript mutation, remove live WS endpoints"
```

---

### Task 3: Remove transcription tier limits from `usage.service.ts`

**Files:**
- Modify: `src/server/services/usage.service.ts`

**Step 1: Find and remove these two public methods:**
- `canTranscribe(userId, durationSeconds)` — no longer needed
- `trackTranscriptionUsage(userId, durationSeconds)` — no longer needed

**Step 2: Remove `transcriptionSeconds` from tier limits object** (around line 17-37):

Find the tier limits definition. Remove the `transcriptionSeconds` field from free/pro/team tiers:
```typescript
// REMOVE these lines from each tier:
transcriptionSeconds: 7200,   // free
transcriptionSeconds: 72000,  // pro
transcriptionSeconds: 216000, // team
```

**Step 3: Verify TypeScript compiles — watch for callers**

```bash
npx tsc --noEmit 2>&1 | head -30
```

If you see errors about `canTranscribe` or `trackTranscriptionUsage`, find callers and remove those call sites. Common locations: `session-transcription.ts`, `session-recordings.ts`.

**Step 4: Commit**

```bash
git add src/server/services/usage.service.ts
git commit -m "chore(transcription): remove transcription minute tier limits"
```

---

### Task 4: Update `LiveTranscriptionControls` — remove dead UI elements

**Files:**
- Modify: `src/components/session/live-transcription-controls.tsx`

**Step 1: Remove `DmHintsPanel` import and usage**

Delete:
```typescript
import { DmHintsPanel } from './DmHintsPanel';
```

And delete the `DmHintsPanel` JSX block at the bottom of the return (lines 199-202).

Also delete:
```typescript
const [dismissedHintIndices, setDismissedHintIndices] = useState<Set<number>>(new Set());
const visibleHints = dmHints.filter((_, idx) => !dismissedHintIndices.has(idx));
function handleDismissHint(index: number) { ... }
```

**Step 2: Remove `isConnected` reconnecting indicator**

Delete lines 193-195:
```typescript
{isRecording && !isConnected && (
  <p className="text-xs text-amber-500 mt-2">Reconnecting...</p>
)}
```

**Step 3: Remove `liveStatus` query** (no server-side live status anymore)

Delete:
```typescript
const liveStatus = trpc.sessionTranscription.getLiveTranscriptionStatus.useQuery(
  { sessionId },
  { staleTime: 5000 }
);
const isLive = liveStatus.data?.isLive || isRecording;
```

Replace `isLive` with just `isRecording` throughout the component.

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "live-transcription"
```

**Step 5: Commit**

```bash
git add src/components/session/live-transcription-controls.tsx
git commit -m "chore(transcription): remove AssemblyAI-specific UI (DmHints, reconnect, live status)"
```

---

### Task 5: Update Prisma schema — add 'web_speech' to source comment

**Files:**
- Modify: `prisma/schema.prisma`

Find the Transcript model's source field comment and update it:

```prisma
// Before:
source          String            @default("upload") // 'upload' | 'live'

// After:
source          String            @default("upload") // 'upload' | 'live' | 'web_speech'
```

No migration needed — it's a comment only. The new value is a valid string; no enum constraint.

**Commit:**

```bash
git add prisma/schema.prisma
git commit -m "chore: document web_speech as valid Transcript source value"
```

---

### Task 6: Smoke test — verify end-to-end flow

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Open a session's live page in Chrome**

Navigate to any session → click "Live Session" (or `/campaigns/[slug]/sessions/[id]/live`).

**Step 3: Test transcription**

1. Click "Start Live Transcription"
2. Browser prompts for mic permission — allow it
3. Speak a sentence. Interim text should appear in the scroll area.
4. Wait for a final result (badge segment appears).
5. Click "Stop"

**Step 4: Verify transcript saved**

Check Prisma Studio or run:

```bash
python C:/Users/mail/.claude/skills/agent-skills/skills/read-only-postgres/scripts/query.py \
  --db quiverdm-local \
  --query "SELECT id, source, LEFT(raw_text, 100), duration_seconds FROM transcripts ORDER BY created_at DESC LIMIT 3;"
```

Expected: a row with `source = 'web_speech'` and your spoken text in `raw_text`.

**Step 5: Verify browser fallback message on Firefox**

Open Firefox, go to the live page, click Start. Should see:
> "Live transcription requires Chrome or Edge. Try uploading a recording instead."

---

### Task 7: Full type check and lint

```bash
npx tsc --noEmit && npm run lint
```

Fix any remaining errors (likely stray imports referencing the old WS endpoints).

**Commit:**

```bash
git add -A
git commit -m "chore: fix remaining type errors after transcription refactor"
```

---

### What this does NOT touch (intentionally)

- `src/lib/transcription/assemblyai.ts` — async file upload path still used by post-session recording upload
- `src/lib/queue/transcription-worker.ts` / `transcription-queue.ts` — still needed for uploaded recording files
- `src/server/routers/session-recordings.ts` — upload + async transcription path untouched
- WebSocket server (`npm run dev:ws`) — can remain for future use; just no longer called for transcription

These are the optional "upload a recording file for high-quality transcription" paths. They're now a distinct feature from live transcription, not the default path.
