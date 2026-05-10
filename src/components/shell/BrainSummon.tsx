'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { Canvas, Summon } from '@/components/primitives'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { useHeaderStore } from '@/store/header-store'

export function BrainSummon() {
  const { brainOpen, setBrainOpen, slot } = useHeaderStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [question, setQuestion] = useState('')

  const campaignId = slot?.campaignId
  const campaignSlug = slot?.campaignSlug
  const campaignTitle = slot?.title

  const query = trpc.brain.query.useMutation()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘/Ctrl+B opens the Brain — ⌘/Ctrl+K is owned by global search now.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setBrainOpen(true)
      }
      if (e.key === 'Escape') setBrainOpen(false)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setBrainOpen])

  useEffect(() => {
    if (brainOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuestion('')
      query.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainOpen])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || !campaignId || query.isPending) return
    query.mutate({ campaignId, question: trimmed })
  }

  return (
    <Summon
      variant="grimoire-overlay"
      open={brainOpen}
      onOpenChange={setBrainOpen}
      className={cn(
        'p-0 gap-0 overflow-hidden border-none bg-transparent shadow-none',
        '[&>button]:right-5 [&>button]:top-5 [&>button]:text-[var(--q-text-faint)]',
        '[&>button]:ring-0 [&>button:hover]:text-[var(--q-text)] [&>button[data-state=open]]:bg-transparent',
      )}
    >
      <Canvas
        variant="summon"
        className={cn(
          'min-h-0 rounded-[var(--radius)] border border-[var(--q-border-signature)]',
          'bg-[linear-gradient(180deg,var(--q-surface-signature),var(--q-bg))]',
        )}
      >
        <div
          data-testid="brain-summon"
          role="dialog"
          aria-modal="true"
          aria-label="The Brain"
          className="relative"
        >
          <div className="flex items-center gap-3 border-b border-[var(--q-border-subtle)] px-5 py-4">
            <span className="text-lg text-[var(--q-amber)]">&#x2316;</span>
            <span className="font-[var(--q-font-display)] text-xs uppercase tracking-[3px] text-[var(--q-amber)]">
              The Brain
            </span>
            {campaignTitle && (
              <span className="max-w-[200px] truncate text-[10px] text-[var(--q-text-faint)]">
                {' · '}
                {campaignTitle}
              </span>
            )}
            <span className="ml-auto pr-8 text-[10px] text-[var(--q-text-faint)]">ESC to close</span>
          </div>

          {campaignId ? (
            <form onSubmit={onSubmit} className="border-b border-[var(--q-border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask anything about your world..."
                  disabled={query.isPending}
                  className={cn(
                    'flex-1 border-none bg-transparent text-sm text-[var(--q-text)] outline-none',
                    'font-[var(--q-font-body)] placeholder:text-[var(--q-text-faint)] disabled:opacity-60',
                  )}
                />
                {query.isPending && (
                  <Loader2 size={14} className="shrink-0 animate-spin text-[var(--q-amber)]" />
                )}
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3 border-b border-[var(--q-border-subtle)] px-5 py-6 text-[var(--q-text-faint)]">
              <AlertCircle size={16} className="shrink-0" />
              <span className="text-sm">Open a campaign to ask the Brain about its world.</span>
            </div>
          )}

          <div className="min-h-[80px] px-5 py-4">
            {query.isPending && (
              <p className="text-xs text-[var(--q-text-faint)]">Consulting the Brain...</p>
            )}
            {query.error && (
              <p className="text-xs text-[var(--q-text-danger)]">{query.error.message}</p>
            )}
            {query.data && (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--q-text)]">
                  {query.data.answer}
                </p>
                {query.data.relatedEntities.length > 0 && campaignSlug && (
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--q-border-subtle)] pt-2">
                    <Sparkles size={10} className="mt-1 text-[var(--q-amber)]" />
                    {query.data.relatedEntities.map((e) => (
                      <Link
                        key={e.id}
                        href={`/campaigns/${campaignSlug}/brain?entity=${e.id}`}
                        onClick={() => setBrainOpen(false)}
                        className={cn(
                          'rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-amber-trace)] px-2 py-0.5 text-[10px]',
                          'text-[var(--q-text-dim)] transition-colors hover:text-[var(--q-amber)]',
                        )}
                      >
                        {e.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!query.isPending && !query.data && !query.error && campaignId && (
              <p className="text-xs text-[var(--q-text-faint)]">
                Try: &ldquo;Who is the antagonist?&rdquo; · &ldquo;What faction holds the harbour?&rdquo;
              </p>
            )}
          </div>

          <div className="border-t border-[var(--q-border-subtle)] px-5 py-2.5">
            <span className="text-[10px] text-[var(--q-text-faint)]">
              Enter to ask · ESC to close · powered by your DM Brain
            </span>
          </div>
        </div>
      </Canvas>
    </Summon>
  )
}
