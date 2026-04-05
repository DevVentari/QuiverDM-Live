// src/components/recap/speaker-mapping-step.tsx
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mic } from 'lucide-react';

interface SpeakerMappingStepProps {
  campaignId: string;
  transcriptId: string;
  speakerLabels: string[];
  onComplete: () => void;
}

interface MappingRow {
  speakerLabel: string;
  characterId: string;
  characterName: string;
  isDM: boolean;
  error?: string;
}

export function SpeakerMappingStep({
  campaignId,
  transcriptId,
  speakerLabels,
  onComplete,
}: SpeakerMappingStepProps) {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: existingMappings } = trpc.speakerMapping.getByCampaign.useQuery({ campaignId });
  const { data: characters } = trpc.characters.getCampaignCharacters.useQuery({ campaignId });

  const upsert = trpc.speakerMapping.upsert.useMutation();
  const applyToTranscript = trpc.speakerMapping.applyToTranscript.useMutation();

  // Initialize rows once existing mappings are loaded
  useEffect(() => {
    if (existingMappings === undefined) return;
    const existingMap = new Map(existingMappings.map((m) => [m.speakerLabel, m]));
    setRows(
      speakerLabels.map((label) => {
        const existing = existingMap.get(label);
        return {
          speakerLabel: label,
          characterId: existing?.characterId ?? '',
          characterName: existing?.characterName ?? '',
          isDM: existing?.isDM ?? false,
        };
      })
    );
  }, [existingMappings, speakerLabels]);

  const updateRow = (index: number, patch: Partial<MappingRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch, error: undefined } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    const errors: Record<number, string> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip rows with no mapping
      if (!row.characterId && !row.isDM) continue;
      try {
        await upsert.mutateAsync({
          campaignId,
          speakerLabel: row.speakerLabel,
          characterId: row.characterId || undefined,
          characterName: row.isDM ? 'DM' : row.characterName,
          isDM: row.isDM,
        });
      } catch (err) {
        errors[i] = String(err);
      }
    }

    if (Object.keys(errors).length > 0) {
      setRows((prev) => prev.map((r, i) => ({ ...r, error: errors[i] })));
      setSaving(false);
      return;
    }

    // Best-effort patch — failure is logged but never blocks the user
    try {
      await applyToTranscript.mutateAsync({ campaignId, transcriptId });
    } catch (err) {
      console.error('[SpeakerMappingStep] applyToTranscript failed:', err);
    }

    setSaving(false);
    onComplete();
  };

  if (existingMappings === undefined || characters === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-white/80">Map Speakers to Characters</p>
        <p className="mt-0.5 text-xs text-white/40">
          Saved for this campaign — applied automatically in future sessions.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.speakerLabel}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <Mic className="h-4 w-4 shrink-0 text-amber-500/60" />
            <span className="w-28 shrink-0 truncate text-sm text-white/70">{row.speakerLabel}</span>

            <Select
              value={row.characterId}
              onValueChange={(val) => {
                const char = characters.find((c) => c.character.id === val);
                updateRow(i, {
                  characterId: val,
                  characterName: char?.character.name ?? '',
                  isDM: false,
                });
              }}
              disabled={row.isDM || saving}
            >
              <SelectTrigger className="h-7 flex-1 border-white/10 bg-white/5 text-xs">
                <SelectValue
                  placeholder={
                    characters.length === 0 ? 'No characters added' : 'Select character…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {characters.map((cc) => (
                  <SelectItem key={cc.character.id} value={cc.character.id}>
                    {cc.character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex shrink-0 items-center gap-1.5">
              <Checkbox
                id={`dm-${i}`}
                checked={row.isDM}
                onCheckedChange={(checked) =>
                  updateRow(i, {
                    isDM: !!checked,
                    characterId: checked ? '' : row.characterId,
                    characterName: checked ? '' : row.characterName,
                  })
                }
                disabled={saving}
              />
              <label htmlFor={`dm-${i}`} className="cursor-pointer text-xs text-white/50">
                DM
              </label>
            </div>

            {row.error && <span className="shrink-0 text-xs text-red-400">✗</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-amber-500 text-black hover:bg-amber-400"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save & Continue'
          )}
        </Button>
        <button
          onClick={onComplete}
          disabled={saving}
          className="text-sm text-white/30 hover:text-white/60"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
