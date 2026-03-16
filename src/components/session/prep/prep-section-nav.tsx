'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export const PREP_SECTIONS = [
  { id: 'characters',   label: 'Characters' },
  { id: 'strong-start', label: 'Strong Start' },
  { id: 'scenes',       label: 'Scenes' },
  { id: 'secrets',      label: 'Secrets & Clues' },
  { id: 'npcs',         label: 'Featured NPCs' },
  { id: 'monsters',     label: 'Monsters' },
  { id: 'rewards',      label: 'Rewards' },
  { id: 'threads',      label: 'Loose Threads' },
] as const;

export type SectionId = (typeof PREP_SECTIONS)[number]['id'];

interface PrepSectionNavProps {
  completedSections: Set<SectionId>;
  activeSection?: SectionId;
  onSectionClick: (id: SectionId) => void;
}

export function PrepSectionNav({ completedSections, activeSection, onSectionClick }: PrepSectionNavProps) {
  return (
    <nav className="py-4 px-3 space-y-0.5">
      {PREP_SECTIONS.map((section) => {
        const isComplete = completedSections.has(section.id);
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-medium transition-colors text-left',
              isActive
                ? 'bg-amber-500/10 text-amber-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            <span className={cn(
              'flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center',
              isComplete
                ? 'border-amber-500/60 bg-amber-500/20'
                : 'border-border/50'
            )}>
              {isComplete && <Check className="h-2.5 w-2.5 text-amber-400" />}
            </span>
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
