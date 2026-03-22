import crypto from 'crypto';

// ─── Errors ──────────────────────────────────────────────────────────────────

export class DdbAuthError extends Error {
  constructor(message = 'CobaltSession expired or invalid') {
    super(message);
    this.name = 'DdbAuthError';
  }
}

export class DdbFetchError extends Error {
  constructor(public url: string, public status: number) {
    super(`DDB fetch failed: ${status} ${url}`);
    this.name = 'DdbFetchError';
  }
}

export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function getCheerio() {
  return import('cheerio');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function exchangeCobaltForJwt(cobaltSession: string): Promise<string> {
  const res = await fetch('https://auth-service.dndbeyond.com/v1/cobalt-token', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `CobaltSession=${cobaltSession}`,
    },
  });
  if (!res.ok) throw new DdbAuthError();
  const data = await res.json() as Record<string, unknown>;
  if (!data || typeof data.token !== 'string') throw new DdbAuthError();
  return data.token;
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────

async function fetchWithAuth(url: string, cobaltJwt: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cobaltJwt}` },
  });
  if (!res.ok) throw new DdbFetchError(url, res.status);
  return res.text();
}

async function fetchWithCookie(url: string, cobaltSession: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Cookie: `CobaltSession=${cobaltSession}` },
  });
  if (!res.ok) throw new DdbFetchError(url, res.status);
  return res.text();
}

// ─── TOC ─────────────────────────────────────────────────────────────────────

export interface DdbChapterMeta {
  slug: string;
  title: string;
  chapterIndex: number;
}

export function parseChapterToc(html: string, sourceSlug: string): DdbChapterMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { load } = require('cheerio') as typeof import('cheerio');
  const $ = load(html);
  return $('.compendium-toc-full-text h3 a')
    .toArray()
    .map((el, i) => {
      const href = $(el).attr('href') ?? '';
      const slug = href.split('/').pop() ?? '';
      return { slug, title: $(el).text().trim(), chapterIndex: i };
    })
    .filter(c => c.slug && c.slug !== sourceSlug);
}

export async function fetchSourcebookToc(
  sourceSlug: string,
  cobaltSession: string
): Promise<DdbChapterMeta[]> {
  const urls = [
    `https://www.dndbeyond.com/sources/dnd/${sourceSlug}`,
    `https://www.dndbeyond.com/sources/${sourceSlug}`,
  ];
  for (const url of urls) {
    const html = await fetchWithCookie(url, cobaltSession);
    const chapters = parseChapterToc(html, sourceSlug);
    if (chapters.length > 0) return chapters;
    await delay(500);
  }
  return [];
}

// ─── Chapter content ─────────────────────────────────────────────────────────

export interface MonsterLink {
  ddbId: string;
  slug: string;
  name: string;
  url: string;
}

export interface ChapterContent {
  monsterLinks: MonsterLink[];
  encounterAreas: string[];
  prose: string;
  contentHash: string;
}

export function parseChapterContent(html: string): ChapterContent {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { load } = require('cheerio') as typeof import('cheerio');
  const $ = load(html);
  const content = $('.p-article-content');

  const monsterMap = new Map<string, MonsterLink>();
  content.find('a[href*="/monsters/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/monsters\/(\d+)-([^/?#]+)/);
    if (!match) return;
    const [, ddbId, slug] = match;
    if (!monsterMap.has(ddbId)) {
      monsterMap.set(ddbId, { ddbId, slug, name: $(el).text().trim(), url: href });
    }
  });

  const encounterAreas: string[] = [];
  content.find('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) encounterAreas.push(text);
  });

  const prose = content.text().replace(/\s+/g, ' ').trim();
  const contentHash = crypto.createHash('sha256').update(prose).digest('hex');

  return { monsterLinks: Array.from(monsterMap.values()), encounterAreas, prose, contentHash };
}

export async function fetchChapterContent(
  sourceSlug: string,
  chapterSlug: string,
  cobaltJwt: string
): Promise<ChapterContent> {
  const html = await fetchWithAuth(
    `https://www.dndbeyond.com/sources/${sourceSlug}/${chapterSlug}`,
    cobaltJwt
  );
  return parseChapterContent(html);
}

export async function fetchChapterContentWithCookie(
  sourceSlug: string,
  chapterSlug: string,
  cobaltSession: string
): Promise<ChapterContent> {
  const html = await fetchWithCookie(
    `https://www.dndbeyond.com/sources/${sourceSlug}/${chapterSlug}`,
    cobaltSession
  );
  return parseChapterContent(html);
}

// ─── Monster stat block ───────────────────────────────────────────────────────

export interface DdbMonsterData {
  ddbId: string;
  name: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  speed: string;
  cr: string;
  xp: number;
  sourceUrl: string;
}

export async function fetchMonsterData(
  ddbId: string,
  slug: string,
  cobaltJwt: string
): Promise<DdbMonsterData | null> {
  try {
    const url = `https://www.dndbeyond.com/monsters/${ddbId}-${slug}`;
    const html = await fetchWithAuth(url, cobaltJwt);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { load } = require('cheerio') as typeof import('cheerio');
    const $ = load(html);

    const name = $('.mon-stat-block__name-link, .mon-stat-block__name').first().text().trim();
    if (!name) return null;

    const meta = $('.mon-stat-block__meta').first().text().trim();
    const lastComma = meta.lastIndexOf(',');
    const type = lastComma >= 0 ? meta.slice(0, lastComma).trim() : meta;
    const alignment = lastComma >= 0 ? meta.slice(lastComma + 1).trim() : 'unaligned';

    function getAttr(label: string): string {
      let val = '';
      $('.mon-stat-block__attribute').each((_, el) => {
        if ($(el).find('.mon-stat-block__attribute-label').text().trim() === label) {
          val = $(el).find('.mon-stat-block__attribute-data-value, .mon-stat-block__attribute-value').text().trim();
        }
      });
      return val;
    }

    function getTidbit(label: string): string {
      let val = '';
      $('.mon-stat-block__tidbit').each((_, el) => {
        if ($(el).find('.mon-stat-block__tidbit-label').text().trim() === label) {
          val = $(el).find('.mon-stat-block__tidbit-data').text().trim();
        }
      });
      return val;
    }

    const crMatch = getTidbit('Challenge').match(/^([\d/]+)\s*\((\d+)\s*XP\)/i);

    return {
      ddbId, name, type, alignment,
      ac: parseInt(getAttr('Armor Class'), 10) || 10,
      hp: parseInt(getAttr('Hit Points'), 10) || 1,
      speed: getAttr('Speed') || '30 ft.',
      cr: crMatch?.[1] ?? '0',
      xp: parseInt(crMatch?.[2] ?? '0', 10),
      sourceUrl: url,
    };
  } catch {
    return null;
  }
}

// ─── Entitlement listing ──────────────────────────────────────────────────────

export interface DdbEntitlementData {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  accessType: 'owned' | 'shared' | 'free';
  sourceUrl: string;
}

export async function fetchUserEntitlements(cobaltSession: string): Promise<DdbEntitlementData[]> {
  const html = await fetchWithCookie('https://www.dndbeyond.com/en/library', cobaltSession);

  // DDB embeds JSON-LD ItemList blocks with all owned books — more reliable than CSS scraping
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const match of ldBlocks) {
    if (!match[1].includes('ItemList')) continue;
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      const graph = Array.isArray(data['@graph'])
        ? (data['@graph'] as Record<string, unknown>[])
        : [data];
      for (const node of graph) {
        if (node['@type'] !== 'ItemList') continue;
        const items = (node['itemListElement'] as Record<string, unknown>[] | undefined) ?? [];
        return items.flatMap(item => {
          const book = (item['item'] as Record<string, string | undefined>) ?? {};
          const url = book['url'] ?? '';
          const slugMatch = url.match(/\/sources\/(?:dnd\/)?([^/?#]+)/);
          if (!slugMatch || !book['name']) return [];
          return [{
            slug: slugMatch[1],
            title: book['name'] as string,
            coverImageUrl: (book['image'] as string | undefined) ?? null,
            accessType: 'owned' as const,
            sourceUrl: url,
          }];
        });
      }
    } catch {
      // try next block
    }
  }

  return [];
}
