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
    expect(result.error).toContain('No AI providers');
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

  it('DEFAULT_BASE_URL falls back to localhost when OLLAMA_BASE_URL is unset', () => {
    // Static check: the module constant uses the env var with a localhost fallback.
    // This is validated by reading the source; integration coverage is in E2E tests.
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../src/lib/ai/ollama.ts'),
      'utf8'
    );
    expect(src).toContain("process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'");
  });
});
