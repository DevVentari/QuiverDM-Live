'use client';

import type { CoDMPermissionLevel } from '@/lib/co-dm/types';

const LEVELS: { value: CoDMPermissionLevel; label: string; description: string }[] = [
  { value: 'Manual', label: 'Manual', description: 'No suggestions' },
  { value: 'Assist', label: 'Assist', description: 'High-confidence alerts only' },
  { value: 'AutoMechanical', label: 'Auto Mechanical', description: 'Rule reminders + alerts' },
  { value: 'FullCoDM', label: 'Full Co-DM', description: 'All suggestions' },
];

interface CoDMSettingsProps {
  value: CoDMPermissionLevel;
  onChange: (v: CoDMPermissionLevel) => void;
}

export function CoDMSettings({ value, onChange }: CoDMSettingsProps) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Co-DM Level</span>
      <div className="grid grid-cols-2 gap-1 mt-1">
        {LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={[
              'rounded border px-2 py-1.5 text-left transition-colors',
              value === level.value
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-border bg-background/40 text-muted-foreground hover:border-amber-400/30 hover:bg-amber-400/5',
            ].join(' ')}
          >
            <div className="text-[11px] font-medium leading-tight">{level.label}</div>
            <div className="text-[9px] leading-tight opacity-70">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
