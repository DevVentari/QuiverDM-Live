'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

// Particle data — fixed positions so no hydration mismatch
const PARTICLES = [
  { id: 1, left: '15%', delay: '0s', duration: '6s', size: 3, opacity: 0.5 },
  { id: 2, left: '22%', delay: '1.2s', duration: '8s', size: 2, opacity: 0.3 },
  { id: 3, left: '35%', delay: '0.4s', duration: '7s', size: 4, opacity: 0.6 },
  { id: 4, left: '48%', delay: '2s', duration: '5s', size: 2, opacity: 0.4 },
  { id: 5, left: '55%', delay: '0.8s', duration: '9s', size: 3, opacity: 0.5 },
  { id: 6, left: '63%', delay: '1.6s', duration: '6.5s', size: 2, opacity: 0.3 },
  { id: 7, left: '72%', delay: '0.2s', duration: '7.5s', size: 4, opacity: 0.55 },
  { id: 8, left: '80%', delay: '2.4s', duration: '8s', size: 2, opacity: 0.35 },
  { id: 9, left: '88%', delay: '1s', duration: '6s', size: 3, opacity: 0.45 },
  { id: 10, left: '10%', delay: '3s', duration: '10s', size: 2, opacity: 0.3 },
  { id: 11, left: '42%', delay: '1.8s', duration: '7s', size: 3, opacity: 0.4 },
  { id: 12, left: '92%', delay: '0.6s', duration: '8.5s', size: 2, opacity: 0.35 },
];

interface PortalSceneProps {
  children: React.ReactNode;
}

export function PortalScene({ children }: PortalSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerBgRef = useRef<HTMLDivElement>(null);
  const layerFogRef = useRef<HTMLDivElement>(null);
  const layerRingRef = useRef<HTMLDivElement>(null);
  const layerFormRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const container = containerRef.current;
    if (!container) return;

    function onMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    }

    function tick() {
      const lerp = 0.06;
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * lerp;

      const mx = currentRef.current.x;
      const my = currentRef.current.y;

      if (layerBgRef.current) {
        layerBgRef.current.style.transform = `translate(${mx * -18}px, ${my * -10}px) scale(1.06)`;
      }
      if (layerFogRef.current) {
        layerFogRef.current.style.transform = `translate(${mx * -10}px, ${my * -6}px)`;
      }
      if (layerRingRef.current) {
        layerRingRef.current.style.transform = `translate(${mx * -6}px, ${my * -4}px)`;
      }
      if (layerFormRef.current) {
        layerFormRef.current.style.transform = `translate(${mx * 8}px, ${my * 5}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    container.addEventListener('mousemove', onMouseMove);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      className="portal-scene relative min-h-screen w-full overflow-hidden flex items-center justify-center dark"
    >
      {/* Layer 1: Background image */}
      <div
        ref={layerBgRef}
        className="absolute inset-[-6%] bg-cover bg-center bg-no-repeat will-change-transform"
        style={{
          backgroundImage: "url('/images/login-bg.jpg')",
          background: "url('/images/login-bg.jpg') center/cover no-repeat, linear-gradient(160deg, hsl(240 15% 8%) 0%, hsl(25 20% 10%) 50%, hsl(240 10% 6%) 100%)",
        }}
      />

      {/* Layer 2: Atmospheric fog */}
      <div
        ref={layerFogRef}
        className="portal-fog absolute inset-0 will-change-transform pointer-events-none"
      />

      {/* Layer 3: Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, hsl(240 10% 4% / 0.85) 100%)',
        }}
      />

      {/* Layer 4: Portal ring */}
      <div
        ref={layerRingRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
      >
        <div className="portal-ring" aria-hidden="true">
          <div className="portal-ring-inner" />
        </div>
      </div>

      {/* Layer 5: Particles */}
      {!reduced && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="portal-particle absolute bottom-0 rounded-full"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
                background: `hsl(35 80% ${55 + Math.floor(p.id * 3) % 20}%)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 6: Login form */}
      <div
        ref={layerFormRef}
        className={`relative z-10 will-change-transform ${reduced ? '' : 'portal-form-float'}`}
      >
        {children}
      </div>
    </div>
  );
}
