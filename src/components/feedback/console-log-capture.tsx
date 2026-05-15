'use client';

import { useEffect } from 'react';

export type CapturedLog = {
  ts: number;
  level: 'error' | 'warn';
  msg: string;
};

const MAX_LOGS = 50;
const MAX_MSG_LENGTH = 500;
const logBuffer: CapturedLog[] = [];

const originalError = typeof console !== 'undefined' ? console.error.bind(console) : null;
const originalWarn = typeof console !== 'undefined' ? console.warn.bind(console) : null;

function push(level: 'error' | 'warn', args: unknown[]) {
  const msg = args
    .map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ')
    .slice(0, MAX_MSG_LENGTH);
  if (logBuffer.length >= MAX_LOGS) logBuffer.shift();
  logBuffer.push({ ts: Date.now(), level, msg });
}

export function getConsoleLogs(): CapturedLog[] {
  return [...logBuffer];
}

export function clearConsoleLogs() {
  logBuffer.length = 0;
}

export function ConsoleLogCapture() {
  useEffect(() => {
    console.error = (...args: unknown[]) => {
      push('error', args);
      originalError?.(...args);
    };
    console.warn = (...args: unknown[]) => {
      push('warn', args);
      originalWarn?.(...args);
    };
    return () => {
      if (originalError) console.error = originalError;
      if (originalWarn) console.warn = originalWarn;
    };
  }, []);

  return null;
}
