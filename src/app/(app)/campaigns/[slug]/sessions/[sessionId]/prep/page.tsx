'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SessionPrepRedirect() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/campaigns/${slug}/sessions/prep?sessionId=${sessionId}`);
  }, [slug, sessionId, router]);

  return null;
}

