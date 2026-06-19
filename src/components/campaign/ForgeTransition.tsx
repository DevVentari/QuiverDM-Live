// src/components/campaign/ForgeTransition.tsx
'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Latency-honest "mist" overlay shown over the dashboard until the first seeded
 * artifact is ready (or the parent's hard cap elapses). Parent unmounts it by
 * flipping `open` to false; the fog then parts. Reduced-motion → quick fade.
 */
export function ForgeTransition({ open, label }: { open: boolean; label: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="forge-mist"
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[var(--qd-bg)]"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0.2 : 0.9, ease: 'easeInOut' } }}
        >
          {!reduce && (
            <>
              <motion.div
                className="pointer-events-none absolute inset-[-30%] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(150,140,120,0.28), transparent 60%)' }}
                animate={{ x: ['-12%', '14%'], y: ['6%', '-8%'], scale: [1.1, 1.3] }}
                transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              />
              <motion.div
                className="pointer-events-none absolute inset-[-30%] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(120,110,100,0.22), transparent 60%)' }}
                animate={{ x: ['10%', '-10%'], y: ['-6%', '8%'], scale: [1.2, 1.05] }}
                transition={{ duration: 7, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              />
            </>
          )}
          <div className="relative z-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--qd-border-accent)] text-[var(--qd-accent-text)] shadow-[0_0_40px_-6px_var(--qd-accent)]">
              ✦
            </div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--qd-accent-text)]">{label}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
