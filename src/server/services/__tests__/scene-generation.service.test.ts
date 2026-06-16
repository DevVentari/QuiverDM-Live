import { describe, it, expect } from 'vitest';
import { applyRegeneration } from '../scene-generation.service';
import type { GeneratedScene } from '@/lib/ai/generate-scene';

const GEN: GeneratedScene = {
  title: 'New Title', type: 'rp', readAloud: 'NEW read', dmNotes: 'NEW notes',
  musicCue: 'NEW cue', suggestedChecks: [{ skill: 'Insight', dc: 12, note: 'lie' }],
  entityBeats: {},
};

const CURRENT = {
  title: 'Old Title', type: 'theatre', description: 'OLD read', dmNotes: 'OLD notes',
  musicCue: 'OLD cue', suggestedChecks: [{ skill: 'Perception', dc: 15, note: 'see' }],
};

describe('applyRegeneration', () => {
  it('section "all" replaces every generated field', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'all');
    expect(patch.description).toBe('NEW read');
    expect(patch.dmNotes).toBe('NEW notes');
    expect(patch.musicCue).toBe('NEW cue');
  });

  it('section "readAloud" only overwrites the read-aloud', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'readAloud');
    expect(patch.description).toBe('NEW read');
    expect(patch.dmNotes).toBeUndefined();
    expect(patch.musicCue).toBeUndefined();
  });

  it('section "checks" only overwrites suggestedChecks', () => {
    const patch = applyRegeneration(CURRENT, GEN, 'checks');
    expect(patch.suggestedChecks).toEqual(GEN.suggestedChecks);
    expect(patch.description).toBeUndefined();
  });
});
