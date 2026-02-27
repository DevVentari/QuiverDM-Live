'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Redirect /sessions/new → /sessions/prep (canonical Lazy DM wizard route). */
export default function SessionsNewRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/campaigns/${slug}/sessions/prep`);
  }, [slug, router]);

  return null;
}
