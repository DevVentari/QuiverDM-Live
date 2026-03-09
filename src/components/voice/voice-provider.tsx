'use client';

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

interface VoiceContextValue {
  isListening: boolean;
  lastTranscript: string;
  lastResponse: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
}

const VoiceContext = createContext<VoiceContextValue>({
  isListening: false,
  lastTranscript: '',
  lastResponse: null,
  startListening: () => {},
  stopListening: () => {},
  speak: () => {},
});

export function useVoice() {
  return useContext(VoiceContext);
}

interface VoiceProviderProps {
  children: ReactNode;
  onQuery?: (transcript: string) => Promise<string>;
}

export function VoiceProvider({ children, onQuery }: VoiceProviderProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setLastResponse('Voice recognition is not supported in this browser.');
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
      setLastTranscript(transcript);
      setIsListening(false);

      if (onQuery) {
        try {
          const response = await onQuery(transcript);
          setLastResponse(response);
          speak(response);
        } catch {
          setLastResponse('Could not get an answer from the Brain.');
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setLastResponse('Voice recognition error. Try again.');
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onQuery, speak]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <VoiceContext.Provider value={{ isListening, lastTranscript, lastResponse, startListening, stopListening, speak }}>
      {children}
    </VoiceContext.Provider>
  );
}
