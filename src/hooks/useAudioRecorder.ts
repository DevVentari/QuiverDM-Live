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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const cleanupAudioContext = useCallback(() => {
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimers();
      stopStream();
      cleanupAudioContext();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, cleanupAudioContext, stopStream, stopTimers]);

  const measureVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
    const level = Math.round((avg / 255) * 100);
    setVolumeLevel(level >= vadThreshold ? level : 0);
    animFrameRef.current = requestAnimationFrame(measureVolume);
  }, [vadThreshold]);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser');
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setDurationSeconds(0);
      setVolumeLevel(0);
      pausedDurationRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Set up Web Audio analyser for level meter
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

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
        stopTimers();
        setVolumeLevel(0);
        stopStream();
        cleanupAudioContext();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [audioUrl, cleanupAudioContext, measureVolume, stopStream, stopTimers]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      pausedDurationRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
      stopTimers();
    }
  }, [stopTimers]);

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
      stopTimers();
    }
  }, [stopTimers]);

  const reset = useCallback(() => {
    stopTimers();
    stopStream();
    cleanupAudioContext();
    setState('idle');
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDurationSeconds(0);
    setVolumeLevel(0);
    setError(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    mediaRecorderRef.current = null;
  }, [audioUrl, cleanupAudioContext, stopStream, stopTimers]);

  return { state, audioBlob, audioUrl, durationSeconds, volumeLevel, start, pause, resume, stop, reset, error };
}
