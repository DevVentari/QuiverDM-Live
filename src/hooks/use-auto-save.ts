'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delayMs = 2000
) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(data));
  const isDirtyRef = useRef(false);

  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;

    isDirtyRef.current = true;
    setStatus('unsaved');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await onSave(data);
        lastSavedRef.current = serialized;
        isDirtyRef.current = false;
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, onSave, delayMs]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    try {
      await onSave(data);
      lastSavedRef.current = JSON.stringify(data);
      isDirtyRef.current = false;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [data, onSave]);

  return { status, saveNow };
}
