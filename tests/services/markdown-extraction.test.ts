import { vi, it, expect, describe, beforeEach } from 'vitest';

vi.mock('@/lib/ai/chat', () => ({
  chatWithAI: vi.fn(),
}));

import { chatWithAI } from '@/lib/ai/chat';
import { extractEntitiesFromMarkdown } from '@/server/services/markdown-extraction.service';

describe('extractEntitiesFromMarkdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed entities from AI response', async () => {
    vi.mocked(chatWithAI).mockResolvedValueOnce(
      JSON.stringify([
        { type: 'location', name: 'Bonfire Keep', description: 'Ancient fortress.', data: {}, tags: ['fortress'] },
        { type: 'npc', name: 'Mirela', description: 'A weary innkeeper.', data: {}, tags: [] },
      ])
    );

    const result = await extractEntitiesFromMarkdown({
      content: '## Bonfire Keep\nAncient fortress...\n## Mirela\nA weary innkeeper.',
      hint: undefined,
    });

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('location');
    expect(result[0].name).toBe('Bonfire Keep');
    expect(result[1].type).toBe('npc');
  });

  it('returns empty array when AI response is not valid JSON', async () => {
    vi.mocked(chatWithAI).mockResolvedValueOnce('Sorry, I cannot help.');
    const result = await extractEntitiesFromMarkdown({ content: 'some text', hint: undefined });
    expect(result).toEqual([]);
  });

  it('filters out entries with empty names', async () => {
    vi.mocked(chatWithAI).mockResolvedValueOnce(
      JSON.stringify([
        { type: 'location', name: '', description: 'nothing', data: {}, tags: [] },
        { type: 'npc', name: 'Gorven', description: 'A guard.', data: {}, tags: [] },
      ])
    );
    const result = await extractEntitiesFromMarkdown({ content: 'text', hint: undefined });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Gorven');
  });
});
