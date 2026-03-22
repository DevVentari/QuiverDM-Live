'use client';

import { useEffect, useState } from 'react';
import type { LogoVariant } from '@/components/logo/quiver-logo';

const STORAGE_KEY = 'quiverdm-logo-variant';

function rollVariant(): Exclude<LogoVariant, 'gilded'> {
  const roll = Math.floor(Math.random() * 20) + 1;
  if (roll <= 6) return 'arcane';
  if (roll <= 14) return 'standard';
  return 'legendary';
}

export function useLogoVariant(): Exclude<LogoVariant, 'gilded'> {
  const [variant, setVariant] = useState<Exclude<LogoVariant, 'gilded'>>('standard');

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) as LogoVariant | null;
    if (stored && ['arcane', 'standard', 'legendary'].includes(stored)) {
      setVariant(stored as Exclude<LogoVariant, 'gilded'>);
    } else {
      const rolled = rollVariant();
      sessionStorage.setItem(STORAGE_KEY, rolled);
      setVariant(rolled);
    }
  }, []);

  return variant;
}
