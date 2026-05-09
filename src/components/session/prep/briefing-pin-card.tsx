'use client';

import { ArrowLeft } from 'lucide-react';
import { PressureCard } from './pressure-card';
import type { BriefingCard } from '@/lib/briefing-types';

interface BriefingPinCardProps {
  card: BriefingCard;
  onUpdate: (updated: BriefingCard) => void;
  onClose: () => void;
}

export function BriefingPinCard({ card, onUpdate, onClose }: BriefingPinCardProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-b"
        style={{ borderColor: 'oklch(0.2 0.005 270)' }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[11px] transition-opacity opacity-55 hover:opacity-100"
          style={{ color: 'oklch(0.7 0.16 55)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to map
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <PressureCard card={card} onChange={onUpdate} />
      </div>
    </div>
  );
}
