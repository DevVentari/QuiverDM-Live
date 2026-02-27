'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const INK_KEYFRAMES = `
@keyframes inkWrite {
  0%   { opacity: 0; filter: blur(4px); transform: scale(0.5) translateY(2px); }
  55%  { opacity: 1; filter: blur(0);   transform: scale(1.04) translateY(0); }
  100% { opacity: 1; filter: blur(0);   transform: scale(1)    translateY(0); }
}
@keyframes nibBlink {
  0%, 45% { opacity: 1; }
  55%, 100% { opacity: 0; }
}
@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
}
`;

interface VoiceScribeProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export function VoiceScribe({
  value,
  onChange,
  placeholder = 'Start writing or tap the mic to dictate...',
  minHeight = 160,
  className,
}: VoiceScribeProps) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(value);

  // Keep committedRef in sync so the onresult closure always has fresh value
  committedRef.current = value;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  // Auto-scroll to nib as text grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [value, interim]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += t + ' ';
        } else {
          interimChunk += t;
        }
      }

      if (finalChunk) {
        onChange(committedRef.current + finalChunk);
        setInterim('');
      } else {
        setInterim(interimChunk);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onChange]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterim('');
  }, []);

  // Full text to render: committed + interim
  const full = value + interim;
  const committedLen = value.length;

  return (
    <div className={cn('group relative', className)}>
      <style>{INK_KEYFRAMES}</style>

      {isListening ? (
        /* ── Voice mode: magical quill display ── */
        <div
          ref={scrollRef}
          className="w-full overflow-y-auto whitespace-pre-wrap break-words px-0 py-2 text-sm leading-relaxed"
          style={{ minHeight, maxHeight: minHeight * 2 }}
        >
          {full.length === 0 && (
            <span className="italic text-muted-foreground/30">{placeholder}</span>
          )}

          {/* Committed chars — static, no animation */}
          {value}

          {/* Interim chars — each animates in like ink hitting parchment */}
          {interim.split('').map((char, i) => (
            <span
              key={`interim-${i}`}
              style={{
                display: 'inline',
                animation: `inkWrite 0.09s ease-out forwards`,
                animationDelay: `${i * 0.028}s`,
                opacity: 0,
              }}
            >
              {char}
            </span>
          ))}

          {/* Nib cursor — blinking amber bar, like a marker tip */}
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              marginLeft: 1,
              verticalAlign: 'text-bottom',
              background: 'rgba(212,168,83,0.9)',
              borderRadius: 1,
              animation: 'nibBlink 1s step-end infinite',
              boxShadow: '0 0 6px rgba(212,168,83,0.5)',
            }}
          />
        </div>
      ) : (
        /* ── Normal mode: borderless textarea ── */
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight, resize: 'none' }}
          className="w-full bg-transparent border-0 outline-none ring-0 px-0 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none"
        />
      )}

      {/* Mic button — always present, subtle when idle */}
      {supported && (
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Stop dictating' : 'Dictate with voice'}
          className={cn(
            'absolute bottom-1.5 right-0 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200',
            isListening
              ? 'bg-red-500/15 text-red-400'
              : 'text-muted-foreground/20 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100'
          )}
          style={
            isListening
              ? { animation: 'micPulse 1.4s ease-in-out infinite' }
              : undefined
          }
        >
          {isListening ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
