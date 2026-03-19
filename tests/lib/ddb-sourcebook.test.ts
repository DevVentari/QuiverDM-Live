import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

describe('exchangeCobaltForJwt', () => {
  it('returns jwt string on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-jwt', ttl: 1800 }),
    });
    const { exchangeCobaltForJwt } = await import('@/lib/ddb-sourcebook');
    const result = await exchangeCobaltForJwt('cobalt-value');
    expect(result).toBe('test-jwt');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth-service.dndbeyond.com/v1/cobalt-token',
      expect.objectContaining({ headers: expect.objectContaining({ Cookie: 'CobaltSession=cobalt-value' }) })
    );
  });

  it('throws DdbAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { exchangeCobaltForJwt, DdbAuthError } = await import('@/lib/ddb-sourcebook');
    await expect(exchangeCobaltForJwt('bad')).rejects.toThrow(DdbAuthError);
  });

  it('throws DdbAuthError when token is null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: null }) });
    const { exchangeCobaltForJwt, DdbAuthError } = await import('@/lib/ddb-sourcebook');
    await expect(exchangeCobaltForJwt('stale')).rejects.toThrow(DdbAuthError);
  });
});

describe('parseChapterToc', () => {
  it('extracts chapter slugs and indexes', async () => {
    const html = `<div class="compendium-toc-full-text">
      <h3><a href="/sources/veor/chapter-one">Ch. 1</a></h3>
      <h3><a href="/sources/veor/chapter-two">Ch. 2</a></h3>
    </div>`;
    const { parseChapterToc } = await import('@/lib/ddb-sourcebook');
    const chapters = parseChapterToc(html, 'veor');
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({ slug: 'chapter-one', title: 'Ch. 1', chapterIndex: 0 });
    expect(chapters[1]).toEqual({ slug: 'chapter-two', title: 'Ch. 2', chapterIndex: 1 });
  });

  it('excludes the sourcebook slug itself', async () => {
    const html = `<div class="compendium-toc-full-text">
      <h3><a href="/sources/veor">Vecna: Eve of Ruin</a></h3>
      <h3><a href="/sources/veor/intro">Intro</a></h3>
    </div>`;
    const { parseChapterToc } = await import('@/lib/ddb-sourcebook');
    const chapters = parseChapterToc(html, 'veor');
    expect(chapters).toHaveLength(1);
    expect(chapters[0].slug).toBe('intro');
  });
});

describe('parseChapterContent', () => {
  it('extracts monster links, encounter areas, prose, and hash', async () => {
    const html = `<div class="p-article-content">
      <h2>The Graveyard</h2>
      <p>There are <a href="/monsters/17059-wight">wights</a> here.</p>
      <h2>The Catacombs</h2>
    </div>`;
    const { parseChapterContent } = await import('@/lib/ddb-sourcebook');
    const result = parseChapterContent(html);
    expect(result.monsterLinks).toHaveLength(1);
    expect(result.monsterLinks[0]).toMatchObject({ ddbId: '17059', slug: 'wight' });
    expect(result.encounterAreas).toEqual(['The Graveyard', 'The Catacombs']);
    expect(result.prose).toContain('The Graveyard');
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deduplicates monster links by ddbId', async () => {
    const html = `<div class="p-article-content">
      <a href="/monsters/17059-wight">wight</a>
      <a href="/monsters/17059-wight">wight</a>
    </div>`;
    const { parseChapterContent } = await import('@/lib/ddb-sourcebook');
    const result = parseChapterContent(html);
    expect(result.monsterLinks).toHaveLength(1);
  });
});
