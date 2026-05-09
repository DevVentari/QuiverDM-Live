'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PressureCard } from './pressure-card';
import type { BriefingCard } from '@/lib/briefing-types';

interface BriefingBoardProps {
  sessionId: string;
  campaignId: string;
  cards: BriefingCard[];
  onCardsChange: (cards: BriefingCard[]) => void;
}

export function BriefingBoard({ sessionId, campaignId, cards, onCardsChange }: BriefingBoardProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [newCardText, setNewCardText] = useState('');

  const generateMutation = trpc.sessions.generateBriefing.useMutation({
    onSuccess: (data) => onCardsChange(data.cards),
  });

  useEffect(() => {
    if (cards.length === 0 && !generateMutation.isPending) {
      generateMutation.mutate({ sessionId, campaignId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCard(updated: BriefingCard) {
    onCardsChange(cards.map((c) => (c.id === updated.id ? updated : c)));
  }

  function addDmCard() {
    if (!newCardText.trim()) return;
    const card: BriefingCard = {
      id: crypto.randomUUID(),
      type: 'CUSTOM',
      entityName: 'DM Note',
      urgencyLevel: 3,
      context: '',
      proposal: newCardText.trim(),
      status: 'dm-added',
    };
    onCardsChange([...cards, card]);
    setNewCardText('');
    setAddingCard(false);
  }

  const reviewed = cards.filter((c) => c.status !== 'proposed').length;
  const total = cards.length;

  if (generateMutation.isPending) {
    return (
      <div className="flex items-center justify-center gap-3 py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
        <span className="text-sm" style={{ color: 'oklch(0.5 0.01 270)' }}>
          Brain is generating your briefing…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--q-font-display)] text-[9px] uppercase tracking-[0.2em]"
            style={{ color: 'oklch(0.7 0.16 55)' }}
          >
            World Pressure
          </span>
          <div
            className="h-px w-16"
            style={{ background: 'linear-gradient(to right, oklch(0.7 0.16 55 / 0.4), transparent)' }}
          />
        </div>
        {total > 0 && (
          <button
            onClick={() => generateMutation.mutate({ sessionId, campaignId })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-1 text-[10px]"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        )}
      </div>

      {(generateMutation.isError || (generateMutation.isSuccess && total === 0)) && total === 0 && (
        <p className="text-xs py-6 text-center" style={{ color: 'oklch(0.45 0.01 270)' }}>
          No world data yet — Brain has no pressure points to surface. Run a few sessions and process summaries to build up Brain context,
          or use the import zone above to brief Brain with your notes.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <PressureCard key={card.id} card={card} onChange={updateCard} />
        ))}
      </div>

      {addingCard ? (
        <div
          className="rounded-sm border p-3 space-y-2"
          style={{ borderColor: 'oklch(0.25 0.01 270)', background: 'oklch(0.14 0.005 265)' }}
        >
          <textarea
            placeholder="Describe a scene, NPC, or element you want to include this session…"
            value={newCardText}
            onChange={(e) => setNewCardText(e.target.value)}
            rows={3}
            className="w-full resize-none text-sm rounded-sm px-3 py-2 outline-none focus:ring-1 ring-amber-500/30"
            style={{
              background: 'oklch(0.11 0.005 265)',
              border: '1px solid oklch(0.3 0.01 270)',
              color: 'oklch(0.78 0.01 270)',
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={addDmCard}
              className="text-xs px-3 py-1.5 rounded-sm border"
              style={{
                background: 'oklch(0.2 0.04 55 / 0.3)',
                borderColor: 'oklch(0.35 0.1 55)',
                color: 'oklch(0.7 0.16 55)',
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setAddingCard(false); setNewCardText(''); }}
              className="text-xs px-3 py-1.5 rounded-sm border"
              style={{ borderColor: 'oklch(0.25 0.01 270)', color: 'oklch(0.45 0.01 270)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCard(true)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-sm border text-xs transition-colors"
          style={{
            borderStyle: 'dashed',
            borderColor: 'oklch(0.28 0.01 270)',
            color: 'oklch(0.4 0.01 270)',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add something Brain missed
        </button>
      )}

      {total > 0 && (
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'oklch(0.2 0.005 270)' }}
        >
          <span className="text-xs" style={{ color: 'oklch(0.45 0.01 270)' }}>
            {reviewed} of {total} reviewed
          </span>
          <span
            className="text-[10px]"
            style={{ color: reviewed === total ? 'oklch(0.65 0.15 145)' : 'oklch(0.4 0.01 270)' }}
          >
            {reviewed === total ? '✓ All cards reviewed' : 'Review all cards to unlock Ready to Run'}
          </span>
        </div>
      )}
    </div>
  );
}
