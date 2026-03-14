'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayCharactersPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/characters'); }, [router]);
  return null;
}
