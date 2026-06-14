import { describe, it, expect } from 'vitest';
import { STOCK_VOICES, assignVoice } from '../voice-catalog';

describe('assignVoice', () => {
  it('returns a voiceId that exists in the catalog', () => {
    const voiceId = assignVoice({ gender: 'male', role: 'villain' });
    expect(STOCK_VOICES.some((v) => v.voiceId === voiceId)).toBe(true);
  });

  it('is deterministic: same traits map to the same voice', () => {
    const traits = { gender: 'female', race: 'elf', role: 'merchant' };
    expect(assignVoice(traits)).toBe(assignVoice(traits));
  });

  it('maps a deep-villain archetype to a different voice than a light-merchant', () => {
    const villain = assignVoice({ gender: 'male', role: 'villain' });
    const merchant = assignVoice({ gender: 'female', role: 'merchant' });
    expect(villain).not.toBe(merchant);
  });

  it('falls back to a default voice when traits are empty', () => {
    const voiceId = assignVoice({});
    expect(STOCK_VOICES.some((v) => v.voiceId === voiceId)).toBe(true);
  });
});
