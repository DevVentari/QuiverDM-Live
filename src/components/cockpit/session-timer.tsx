'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export function SessionTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums text-sm">
      <Clock className="h-3.5 w-3.5" />
      <span>{display}</span>
    </div>
  );
}
