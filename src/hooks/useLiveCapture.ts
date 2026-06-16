'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * DM-side live audio capture. Captures the microphone as raw PCM16 mono and
 * streams it as binary frames over the session WebSocket, feeding the server's
 * live transcription pipeline (which forwards to AssemblyAI realtime). Joining as
 * a DM auto-starts the billable live session, so this only runs while `active` —
 * callers gate it behind an explicit "Go live" control, never on page load.
 *
 * Audio path: getUserMedia → AudioContext → ScriptProcessor → Float32→Int16 PCM
 * frames at the context's sample rate (sent to the server's join so AssemblyAI
 * matches). ScriptProcessorNode is deprecated but broadly supported; migrating to
 * an AudioWorklet is a follow-up.
 */
export function useLiveCapture(campaignId: string, sessionId: string, active: boolean) {
  const getToken = trpc.play.getWsToken.useMutation();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active || !campaignId || !sessionId) return;
    let cancelled = false;

    const teardown = () => {
      try { wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify({ type: 'stop_live', sessionId })); } catch { /* ignore */ }
      try { wsRef.current?.close(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close().catch(() => {});
      wsRef.current = null;
      streamRef.current = null;
      ctxRef.current = null;
      setCapturing(false);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        let token: string;
        try {
          token = (await getToken.mutateAsync({ sessionId, campaignId })).token;
        } catch {
          setError('Could not start the live session.');
          teardown();
          return;
        }
        if (cancelled) { teardown(); return; }

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const sampleRate = ctx.sampleRate;

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004';
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          // Tell the server our real sample rate so AssemblyAI matches.
          ws.send(JSON.stringify({ type: 'join_live_session', sessionId, token, sampleRate }));
          setError(null);
          setCapturing(true);
        };
        ws.onerror = () => setError('Live connection lost.');
        ws.onclose = () => setCapturing(false);

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const f32 = e.inputBuffer.getChannelData(0);
          const i16 = new Int16Array(f32.length);
          for (let i = 0; i < f32.length; i++) {
            const s = Math.max(-1, Math.min(1, f32[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(i16.buffer);
        };
        source.connect(processor);
        processor.connect(ctx.destination);
      } catch {
        if (!cancelled) setError('Microphone access was denied.');
        teardown();
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, campaignId, sessionId]);

  return { capturing, error };
}
