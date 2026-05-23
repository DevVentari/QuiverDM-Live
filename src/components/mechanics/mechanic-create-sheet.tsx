'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc'

interface MechanicCreateSheetProps {
  campaignId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

export function MechanicCreateSheet({ campaignId, open, onOpenChange, onCreated }: MechanicCreateSheetProps) {
  const utils = trpc.useUtils()
  const [kind, setKind] = useState<'secret' | 'tarot'>('secret')
  const [name, setName] = useState('')
  const [flavorText, setFlavorText] = useState('')
  const [hiddenTruth, setHiddenTruth] = useState('')
  const [cardName, setCardName] = useState('')
  const [interpretation, setInterpretation] = useState('')

  const create = trpc.mechanics.create.useMutation({
    onSuccess: (m) => {
      void utils.mechanics.list.invalidate({ campaignId })
      onCreated?.(m.id)
      onOpenChange(false)
      setName(''); setFlavorText(''); setHiddenTruth(''); setCardName(''); setInterpretation('')
    },
  })

  function submit() {
    if (!name.trim()) return
    if (kind === 'secret') {
      create.mutate({
        campaignId, kind, name,
        content: { flavorText, hiddenTruth },
      })
    } else {
      create.mutate({
        campaignId, kind, name,
        content: { cardName, suit: 'high', divinationPosition: 'history', interpretation },
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New mechanic</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-5 py-6">
          <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
            <div>
              <p className="label-overline mb-1">Mechanic Details</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--q-text-faint)]">Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'secret' | 'tarot')}
                className="w-full rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] px-3 py-2 text-sm text-[var(--q-text)]"
              >
                <option value="secret">Secret</option>
                <option value="tarot">Tarokka card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--q-text-faint)]">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Glasstaff's secret" />
            </div>
            {kind === 'secret' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--q-text-faint)]">Flavor text (player-facing)</label>
                  <Textarea value={flavorText} onChange={(e) => setFlavorText(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--q-amber)]">Hidden truth (DM-only)</label>
                  <Textarea value={hiddenTruth} onChange={(e) => setHiddenTruth(e.target.value)} rows={3} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--q-text-faint)]">Card name</label>
                  <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="The Tower" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--q-text-faint)]">Interpretation</label>
                  <Textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={3} />
                </div>
              </>
            )}
          </div>
          <Button onClick={submit} disabled={create.isPending || !name.trim()} className="w-full">
            {create.isPending ? 'Creating…' : 'Create mechanic'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
