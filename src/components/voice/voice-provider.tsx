'use client';

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'result';

interface VoiceContextValue {
  isListening: boolean;
  status: VoiceStatus;
  lastTranscript: string;
  lastResponse: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  processCommand: (transcript: string) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue>({
  isListening: false,
  status: 'idle',
  lastTranscript: '',
  lastResponse: null,
  startListening: () => {},
  stopListening: () => {},
  speak: () => {},
  processCommand: async () => {},
});

export function useVoice() {
  return useContext(VoiceContext);
}

interface VoiceProviderProps {
  children: ReactNode;
  onCommand?: (transcript: string) => Promise<string>;
}

export function VoiceProvider({ children, onCommand }: VoiceProviderProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const isListening = status === 'listening';

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const processCommand = useCallback(async (transcript: string) => {
    setLastTranscript(transcript);
    setStatus('processing');

    if (!onCommand) {
      setStatus('idle');
      return;
    }

    try {
      const response = await onCommand(transcript);
      setLastResponse(response);
      setStatus('result');
      if (response) speak(response);
    } catch {
      setLastResponse('Could not get an answer from the Brain.');
      setStatus('result');
    }
  }, [onCommand, speak]);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setLastResponse('Voice recognition is not supported in this browser.');
      setStatus('result');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      await processCommand(transcript);
    };

    recognition.onerror = () => {
      setStatus('idle');
      setLastResponse('Voice recognition error. Try again.');
    };
    recognition.onend = () => {
      setStatus((prev) => prev === 'listening' ? 'idle' : prev);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus('listening');
  }, [processCommand]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus('idle');
  }, []);

  return (
    <VoiceContext.Provider value={{
      isListening,
      status,
      lastTranscript,
      lastResponse,
      startListening,
      stopListening,
      speak,
      processCommand,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}
