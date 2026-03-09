'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [skip, setSkip] = useState(false);

  const { data: settings } = trpc.userSettings.getSettings.useQuery(undefined, {
    staleTime: 300_000,
  });

  useEffect(() => {
    const mobile = window.innerWidth < 768;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mobile || reducedMotion) setSkip(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || skip || settings?.videoBackground === false) return;
    // Start loading only after mount and setting is confirmed on
    video.load();
  }, [skip, settings?.videoBackground]);

  if (skip || settings === undefined || settings.videoBackground === false) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: -2, opacity: visible ? 1 : 0, transition: 'opacity 2s ease' }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/video/dungeon-bg-poster.jpg"
        onCanPlay={() => setVisible(true)}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(0.32) saturate(0.75)' }}
      >
        <source src="/video/dungeon-bg.webm" type="video/webm" />
        <source src="/video/dungeon-bg.mp4" type="video/mp4" />
      </video>
      {/* Readability overlay — darkens bottom and top edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}
