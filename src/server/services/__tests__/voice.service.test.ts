import { describe, it, expect } from 'vitest';
import { buildSignatureText, deriveTraits } from '../voice.service';

describe('deriveTraits', () => {
  it('reads gender/role from entity properties and description', () => {
    const traits = deriveTraits({
      type: 'NPC',
      name: 'Captain Vorth',
      description: 'A scarred half-orc warlord who rules the harbor.',
      properties: { gender: 'male', role: 'villain' },
    });
    expect(traits.gender).toBe('male');
    expect(traits.role).toBe('villain');
    expect(traits.personality).toContain('warlord');
  });
});

describe('buildSignatureText', () => {
  it('uses the first sentence of the description when short enough', () => {
    const text = buildSignatureText({
      name: 'Mira', description: 'You will find no mercy here. Now leave.', properties: {},
    });
    expect(text).toBe('You will find no mercy here.');
  });

  it('falls back to an archetype line when no usable description', () => {
    const text = buildSignatureText({ name: 'Thug', description: null, properties: { role: 'villain' } });
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(160);
  });
});
