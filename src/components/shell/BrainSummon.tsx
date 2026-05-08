'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHeaderStore } from '@/store/header-store'
import { backdropFade, summonFade } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function BrainSummon() {
  const { brainOpen, setBrainOpen } = useHeaderStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setBrainOpen(true)
      }
      if (e.key === 'Escape') setBrainOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setBrainOpen])

  useEffect(() => {
    if (brainOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [brainOpen])

  return (
    <AnimatePresence>
      {brainOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setBrainOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="panel"
            data-testid="brain-summon"
            role="dialog"
            aria-modal="true"
            aria-label="The Brain"
            variants={summonFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed top-[10vh] left-1/2 z-50 -translate-x-1/2 w-full max-w-[540px]',
              'bg-gradient-to-br from-[var(--q-surface-flat)] to-[var(--q-bg)]',
              'border border-[var(--q-amber-border)]',
              'rounded-sm shadow-2xl shadow-black/60',
              '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--q-border-subtle)]">
              <span className="text-[var(--q-amber)] text-lg">&#x2316;</span>
              <span className="font-[var(--q-font-display)] text-xs tracking-[3px] text-[var(--q-amber)] uppercase">
                The Brain
              </span>
              <span className="ml-auto text-[10px] text-[var(--q-text-faint)]">ESC to close</span>
            </div>

            {/* Input */}
            <div className="px-5 py-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask anything about your world…"
                className={cn(
                  'w-full bg-transparent text-[var(--q-text)] text-sm',
                  'placeholder:text-[var(--q-text-faint)]',
                  'border-none outline-none',
                  'font-[var(--q-font-body)]',
                )}
              />
            </div>

            {/* Hint footer */}
            <div className="px-5 py-3 border-t border-[var(--q-border-subtle)]">
              <span className="text-[10px] text-[var(--q-text-faint)]">
                Brain query — full integration in slice 3
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
