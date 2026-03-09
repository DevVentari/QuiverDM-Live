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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const segmentsRef = useRef<LiveTranscriptSegment[]>([]);

  const saveMutation = trpc.sessionTranscription.saveWebSpeechTranscript.useMutation();
  const saveMutateRef = useRef(saveMutation.mutateAsync);
  saveMutateRef.current = saveMutation.mutateAsync;

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

    const recognition = new SpeechRecognitionAPI() as any;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      setError(`Transcription error: ${event.error}`);
      cleanup();
    };

    recognition.onend = () => {
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
      const result = await saveMutateRef.current({
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
  }, [sessionId]);

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
