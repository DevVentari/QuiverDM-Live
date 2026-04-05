import { describe, it, expect } from 'vitest';
import { buildRecapPrompt, SECTION_SHAPES } from '@/lib/recap/recap-prompts';

const BASE_CTX = {
  correctedText: 'The party fought a dragon.',
  speakersJson: '[{"name":"Aria"}]',
  campaignContext: 'Previously the party explored the dungeon.',
};

describe('buildRecapPrompt', () => {
  it('returns non-empty system and user strings for every style', () => {
    for (const style of Object.keys(SECTION_SHAPES) as Array<keyof typeof SECTION_SHAPES>) {
      const { system, user } = buildRecapPrompt({ ...BASE_CTX, style });
      expect(system.length).toBeGreaterThan(0);
      expect(user.length).toBeGreaterThan(0);
    }
  });

  it('includes all section keys and titles for NARRATIVE', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    for (const section of SECTION_SHAPES.NARRATIVE) {
      expect(user).toContain(section.key);
      expect(user).toContain(section.title);
    }
  });

  it('includes all section keys and titles for SESSION_LOG', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'SESSION_LOG' });
    for (const section of SECTION_SHAPES.SESSION_LOG) {
      expect(user).toContain(section.key);
      expect(user).toContain(section.title);
    }
  });

  it('includes section key for BARDS_TALE', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'BARDS_TALE' });
    expect(user).toContain('tale');
  });

  it('includes section key for PREVIOUSLY_ON', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'PREVIOUSLY_ON' });
    expect(user).toContain('cold_open');
  });

  it('includes campaign context in user prompt', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    expect(user).toContain('Previously the party explored the dungeon.');
  });

  it('falls back to placeholder when campaignContext is empty', () => {
    const { user } = buildRecapPrompt({ ...BASE_CTX, campaignContext: '', style: 'NARRATIVE' });
    expect(user).toContain('No prior context available.');
  });

  it('includes JSON sections instruction in every style', () => {
    for (const style of Object.keys(SECTION_SHAPES) as Array<keyof typeof SECTION_SHAPES>) {
      const { user } = buildRecapPrompt({ ...BASE_CTX, style });
      expect(user).toContain('"sections"');
    }
  });

  it('system prompt instructs JSON-only response', () => {
    const { system } = buildRecapPrompt({ ...BASE_CTX, style: 'NARRATIVE' });
    expect(system).toContain('JSON');
    expect(system).toContain('no prose');
  });
});
