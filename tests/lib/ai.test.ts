import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AI extraction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('falls back to next provider when Ollama is unavailable', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    vi.doMock('@/lib/ai/ollama', () => ({
      isOllamaAvailable: vi.fn().mockResolvedValue(false),
    }));

    vi.doMock('@/lib/ai/ollama-extraction', () => ({
      extractBatch: vi.fn(),
    }));

    vi.doMock('@/lib/markdown-parser', () => ({
      parseMarkdown: vi.fn().mockReturnValue({
        sections: [{ type: 'spell', title: 'S', content: 'C' }],
      }),
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '[]' }],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 10 },
        }),
      })
    );

    const { extractWithFallback } = await import('@/lib/ai/extraction');
    const result = await extractWithFallback('# Spell', 'ollama');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gemini');
  });

  it('returns clean failure for empty prompt', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.doMock('@/lib/ai/ollama', () => ({
      isOllamaAvailable: vi.fn().mockResolvedValue(false),
    }));

    vi.doMock('@/lib/ai/ollama-extraction', () => ({
      extractBatch: vi.fn(),
    }));

    vi.doMock('@/lib/markdown-parser', () => ({
      parseMarkdown: vi.fn().mockReturnValue({ sections: [] }),
    }));

    const { extractWithFallback } = await import('@/lib/ai/extraction');
    const result = await extractWithFallback('');

    expect(result.success).toBe(false);
    expect(result.error).toContain('failed');
  });

  it('handles very long prompt gracefully', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.doMock('@/lib/ai/ollama', () => ({
      isOllamaAvailable: vi.fn().mockResolvedValue(false),
    }));

    vi.doMock('@/lib/ai/ollama-extraction', () => ({
      extractBatch: vi.fn(),
    }));

    vi.doMock('@/lib/markdown-parser', () => ({
      parseMarkdown: vi.fn().mockReturnValue({ sections: [] }),
    }));

    const { extractWithFallback } = await import('@/lib/ai/extraction');
    const result = await extractWithFallback('x'.repeat(50000));

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles malformed JSON response without throwing JSON.parse crash', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    vi.doMock('@/lib/ai/ollama', () => ({
      isOllamaAvailable: vi.fn().mockResolvedValue(false),
    }));

    vi.doMock('@/lib/ai/ollama-extraction', () => ({
      extractBatch: vi.fn(),
    }));

    vi.doMock('@/lib/markdown-parser', () => ({
      parseMarkdown: vi.fn().mockReturnValue({ sections: [] }),
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'not-json response' }],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 10 },
        }),
      })
    );

    const { extractContent } = await import('@/lib/ai/extraction');
    const result = await extractContent('# markdown', 'gemini');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse JSON response');
  });

  it('defaults to localhost Ollama URL when OLLAMA_BASE_URL is missing', async () => {
    delete process.env.OLLAMA_BASE_URL;

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { isOllamaAvailable } = await import('@/lib/ai/ollama');
    await isOllamaAvailable();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.any(Object)
    );
  });
});
