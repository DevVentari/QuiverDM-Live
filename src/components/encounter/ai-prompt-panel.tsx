'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

interface AiPromptPanelProps {
  onGenerate: (params: {
    userPrompt: string;
    partySize: number;
    partyLevel: number;
    difficulty: EncounterDifficulty;
  }) => Promise<void>;
  defaultPartySize?: number;
  defaultPartyLevel?: number;
  loading?: boolean;
  className?: string;
}

const DIFFICULTY_OPTIONS: { value: EncounterDifficulty; label: string; color: string }[] = [
  { value: 'easy',   label: 'Easy',   color: 'border-green-500 bg-green-500/10 text-green-600' },
  { value: 'medium', label: 'Medium', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-600' },
  { value: 'hard',   label: 'Hard',   color: 'border-orange-500 bg-orange-500/10 text-orange-600' },
  { value: 'deadly', label: 'Deadly', color: 'border-red-500 bg-red-500/10 text-red-600' },
];

const EXAMPLE_PROMPTS = [
  'Goblin ambush on a forest road, emphasizing ranged attacks from the trees',
  'Undead patrol in a crypt, with a powerful wight leading skeletons',
  'Bandit camp encounter with a mix of melee and spellcasters',
  'Dragon wyrmling guarding its hoard in a cave system',
];

export function AiPromptPanel({
  onGenerate,
  defaultPartySize = 4,
  defaultPartyLevel = 1,
  loading = false,
  className,
}: AiPromptPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [partyLevel, setPartyLevel] = useState(defaultPartyLevel);
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>('medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    await onGenerate({ userPrompt: prompt.trim(), partySize, partyLevel, difficulty });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Party info row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Party Size</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Average Level</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={partyLevel}
            onChange={(e) => setPartyLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Difficulty */}
      <div className="space-y-1">
        <Label className="text-xs">Difficulty</Label>
        <div className="flex gap-1.5">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded border-2 transition-colors',
                difficulty === opt.value ? opt.color : 'border-border text-muted-foreground hover:border-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <Label className="text-xs">Describe the encounter</Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A challenging encounter for 3 level 10 characters set in Avernus, fighting demons near a ruined fortress"
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          maxLength={500}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{prompt.length}/500</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setPrompt(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)])}
          >
            Example prompt
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!prompt.trim() || loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Encounter
          </>
        )}
      </Button>
    </form>
  );
}
