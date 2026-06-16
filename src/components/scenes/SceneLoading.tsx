'use client';

import { motion } from 'framer-motion';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export function SceneLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <motion.div
        aria-hidden
        className="h-16 w-16 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(217,138,61,.5), transparent 70%)' }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className={`${mono} text-[11px] uppercase tracking-[0.18em] text-qd-accent-text`}>The world takes shape…</p>
    </div>
  );
}
