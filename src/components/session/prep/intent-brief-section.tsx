'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface IntentBriefSectionProps {
  sessionId: string;
  campaignId: string;
  initial?: {
    toneKeywords: string[];
    playerGoals: string[];
    dmOnlyTruths: string[];
  } | null;
}

export function IntentBriefSection({ sessionId, campaignId, initial }: IntentBriefSectionProps) {
  const [brief, setBrief] = useState({
    toneKeywords: initial?.toneKeywords ?? [],
    playerGoals: initial?.playerGoals ?? [],
    dmOnlyTruths: initial?.dmOnlyTruths ?? [],
  });
  const [toneInput, setToneInput] = useState('');
  const [dirty, setDirty] = useState(false);

  const update = trpc.sessions.updateIntentBrief.useMutation();

  function addTone(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !toneInput.trim()) return;
    e.preventDefault();
    setBrief(prev => ({ ...prev, toneKeywords: [...prev.toneKeywords, toneInput.trim()] }));
    setToneInput('');
    setDirty(true);
  }

  function removeTone(kw: string) {
    setBrief(prev => ({ ...prev, toneKeywords: prev.toneKeywords.filter(t => t !== kw) }));
    setDirty(true);
  }

  function save() {
    update.mutate({ campaignId, sessionId, intentBrief: brief }, { onSuccess: () => setDirty(false) });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tone</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {brief.toneKeywords.map(kw => (
            <Badge
              key={kw}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeTone(kw)}
            >
              {kw} ×
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Add tone keyword, press Enter"
          value={toneInput}
          onChange={e => setToneInput(e.target.value)}
          onKeyDown={addTone}
          className="max-w-xs"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Players leave with</p>
        <Textarea
          placeholder="One goal per line"
          value={brief.playerGoals.join('\n')}
          onChange={e => {
            setBrief(prev => ({ ...prev, playerGoals: e.target.value.split('\n').filter(Boolean) }));
            setDirty(true);
          }}
          rows={3}
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">DM-only truths</p>
        <Textarea
          placeholder="One truth per line — not visible to players"
          value={brief.dmOnlyTruths.join('\n')}
          onChange={e => {
            setBrief(prev => ({ ...prev, dmOnlyTruths: e.target.value.split('\n').filter(Boolean) }));
            setDirty(true);
          }}
          rows={3}
        />
      </div>

      {dirty && (
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save brief'}
        </Button>
      )}
    </div>
  );
}
