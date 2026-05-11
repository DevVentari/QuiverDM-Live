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

interface RawFetchResult {
  ok: boolean;
  status: number;
  body: string;
  finalUrl: string;
}

async function rawFetchWithAuth(url: string, cobaltJwt: string): Promise<RawFetchResult> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cobaltJwt}` } });
  return { ok: res.ok, status: res.status, body: await res.text(), finalUrl: res.url };
}

async function rawFetchWithCookie(url: string, cobaltSession: string): Promise<RawFetchResult> {
  const res = await fetch(url, { headers: { Cookie: `CobaltSession=${cobaltSession}` } });
  return { ok: res.ok, status: res.status, body: await res.text(), finalUrl: res.url };
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
  /** When this is a sub-page within a parent chapter, the parent's slug. */
  parentSlug?: string;
}

/**
 * Extract chapters AND sub-page chapters from the sourcebook TOC.
 *
 * DDB TOC structure:
 *   <h3 [class="adventure-chapter-header"]><a href=".../chapter-slug">Chapter N: Foo</a></h3>
 *   <ul>
 *     <li><a href=".../chapter-slug#Section">Section heading</a></li>     ← in-page anchor (skip)
 *     <li><strong><a href=".../sub-slug">Sub-page</a></strong></li>       ← sub-page (capture)
 *     <li><a href=".../sub-slug#Section">Sub-section</a></li>             ← anchor under sub-page (skip)
 *   </ul>
 *
 * RotFM uses sub-pages heavily (Ten-Towns has 12+); LMoP has none.
 */
export function parseChapterToc(html: string, sourceSlug: string): DdbChapterMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { load } = require('cheerio') as typeof import('cheerio');
  const $ = load(html);

  function extractSlug(href: string): string {
    const noFragment = href.split('#')[0];
    const slug = noFragment.split('/').filter(Boolean).pop() ?? '';
    return slug;
  }

  const chapters: DdbChapterMeta[] = [];
  const seenSlugs = new Set<string>();
  let runningIndex = 0;

  $('.compendium-toc-full-text h3, .compendium-toc-full-text > h3').each((_, h3) => {
    const $h3 = $(h3);
    const $h3Anchor = $h3.find('a').first();
    const h3Href = $h3Anchor.attr('href') ?? '';
    const h3Slug = extractSlug(h3Href);
    const h3Title = $h3Anchor.text().trim() || $h3.text().trim();

    if (h3Slug && h3Slug !== sourceSlug && !seenSlugs.has(h3Slug)) {
      chapters.push({ slug: h3Slug, title: h3Title, chapterIndex: runningIndex++ });
      seenSlugs.add(h3Slug);
    }

    // Sub-pages are bold links (<strong><a>) inside the following <ul>
    const $ul = $h3.next('ul');
    $ul.find('li > strong > a').each((__, a) => {
      const href = $(a).attr('href') ?? '';
      if (href.includes('#')) return; // anchor, not a sub-page
      const subSlug = extractSlug(href);
      if (!subSlug || subSlug === sourceSlug || subSlug === h3Slug) return;
      if (seenSlugs.has(subSlug)) return;
      chapters.push({
        slug: subSlug,
        title: $(a).text().trim(),
        chapterIndex: runningIndex++,
        parentSlug: h3Slug || undefined,
      });
      seenSlugs.add(subSlug);
    });
  });

  return chapters;
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

export interface MagicItemLink {
  ddbId: string;
  slug: string;
  name: string;
  url: string;
}

export interface ChapterSection {
  heading: string;
  text: string;
}

export interface ChapterImage {
  /** Absolute URL of the image. */
  url: string;
  /** Alt text from <img alt="…">. Often empty on DDB; useful when present. */
  alt: string;
  /** The H2 heading the image was found under (or '(intro)' if before the first H2). */
  sectionHeading: string;
  /** True when the image immediately follows a heading or sits in a sidebar — typically a portrait/key art for the section's entity. */
  isHero: boolean;
}

export interface ChapterContent {
  monsterLinks: MonsterLink[];
  magicItemLinks: MagicItemLink[];
  encounterAreas: string[];
  sections: ChapterSection[];
  images: ChapterImage[];
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

  const magicItemMap = new Map<string, MagicItemLink>();
  content.find('a[href*="/magic-items/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/magic-items\/(\d+)-([^/?#]+)/);
    if (!match) return;
    const [, ddbId, slug] = match;
    if (!magicItemMap.has(ddbId)) {
      magicItemMap.set(ddbId, { ddbId, slug, name: $(el).text().trim(), url: href });
    }
  });

  const encounterAreas: string[] = [];
  content.find('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) encounterAreas.push(text);
  });

  // Walk content elements in document order, splitting into sections at each H2.
  // H3+ headings are kept inline as markdown so the AI can use them as cues.
  // Images are captured with their section context so we can match them back
  // to extracted entities (NPCs/locations/items) by name + section proximity.
  const sections: ChapterSection[] = [];
  const images: ChapterImage[] = [];
  let current: ChapterSection = { heading: '(intro)', text: '' };
  let sawHeadingButNoBody = true; // true when the next image is the section's hero
  const flush = () => {
    if (current.text.trim()) sections.push({ heading: current.heading, text: current.text.trim() });
  };
  const ABS_URL_RE = /^https?:\/\//i;
  content.find('h2, h3, h4, p, ul, ol, table, blockquote, img, figure').each((_, el) => {
    const $el = $(el);
    if ($el.is('h2')) {
      flush();
      current = { heading: $el.text().trim() || '(untitled)', text: '' };
      sawHeadingButNoBody = true;
    } else if ($el.is('h3')) {
      current.text += `\n\n### ${$el.text().trim()}\n`;
      sawHeadingButNoBody = true;
    } else if ($el.is('h4')) {
      current.text += `\n\n#### ${$el.text().trim()}\n`;
      sawHeadingButNoBody = true;
    } else if ($el.is('img')) {
      const rawSrc = $el.attr('src') ?? $el.attr('data-src') ?? '';
      const src = rawSrc.trim();
      if (src && ABS_URL_RE.test(src)) {
        images.push({
          url: src,
          alt: ($el.attr('alt') ?? '').trim(),
          sectionHeading: current.heading,
          isHero: sawHeadingButNoBody,
        });
      }
    } else if ($el.is('figure')) {
      const $img = $el.find('img').first();
      const rawSrc = $img.attr('src') ?? $img.attr('data-src') ?? '';
      const src = rawSrc.trim();
      if (src && ABS_URL_RE.test(src)) {
        images.push({
          url: src,
          alt: ($img.attr('alt') ?? $el.find('figcaption').text() ?? '').trim(),
          sectionHeading: current.heading,
          isHero: sawHeadingButNoBody,
        });
      }
    } else {
      const t = $el.text().replace(/\s+/g, ' ').trim();
      if (t) {
        current.text += `\n${t}`;
        sawHeadingButNoBody = false;
      }
    }
  });
  flush();

  const prose = content.text().replace(/\s+/g, ' ').trim();
  const contentHash = crypto.createHash('sha256').update(prose).digest('hex');

  return {
    monsterLinks: Array.from(monsterMap.values()),
    magicItemLinks: Array.from(magicItemMap.values()),
    encounterAreas,
    sections,
    images,
    prose,
    contentHash,
  };
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
  const urls = [
    `https://www.dndbeyond.com/sources/dnd/${sourceSlug}/${chapterSlug}`,
    `https://www.dndbeyond.com/sources/${sourceSlug}/${chapterSlug}`,
  ];
  for (const url of urls) {
    const html = await fetchWithCookie(url, cobaltSession);
    const result = parseChapterContent(html);
    if (result.prose.length > 100) return result;
  }
  // Return empty result from last attempt
  const html = await fetchWithCookie(urls[urls.length - 1], cobaltSession);
  return parseChapterContent(html);
}

// ─── Monster stat block ───────────────────────────────────────────────────────

import { parseMonsterHtml, type DdbMonsterData } from './ddb-monster-parser';
export type { DdbMonsterData } from './ddb-monster-parser';

export type FetchMonsterResult =
  | { ok: true; data: DdbMonsterData; via: 'jwt' | 'cookie' }
  | { ok: false; reason: string; status?: number; via?: 'jwt' | 'cookie'; htmlSnippet?: string; finalUrl?: string };

/**
 * Try fetching a DDB monster page. Returns a structured Result so callers can
 * classify failures (auth vs 404 vs missing stat block vs JS-rendered shell).
 *
 * Fallback chain: JWT (current behavior) → cookie (chapter pages use cookie auth,
 * may be the right channel for sourcebook-specific monsters too).
 */
export async function fetchMonsterData(
  ddbId: string,
  slug: string,
  cobaltJwt: string,
  cobaltSession?: string
): Promise<FetchMonsterResult> {
  const url = `https://www.dndbeyond.com/monsters/${ddbId}-${slug}`;

  // DDB redirects unowned/JWT-unauthorized monster pages in two ways:
  //   1. /claim/source/<slug>   (LMoP-style — same hostname, different path)
  //   2. marketplace.dndbeyond.com/category/<slug>   (RotFM-style — different subdomain)
  // The JWT often gets these even when the user owns the source; cookie resolves them.
  const looksLikeClaimRedirect = (r: RawFetchResult): boolean => {
    try {
      const u = new URL(r.finalUrl);
      if (u.hostname === 'marketplace.dndbeyond.com') return true;
      if (u.pathname.includes('/claim/source/')) return true;
      if (u.pathname.includes('/marketplace/')) return true;
      // Final defense: if redirected away from the /monsters/<id>-<slug> path entirely,
      // treat as a failed monster fetch and let the cookie path try.
      if (!u.pathname.includes(`/monsters/${ddbId}-`)) return true;
      return false;
    } catch {
      return false;
    }
  };

  let raw: RawFetchResult;
  try {
    raw = await rawFetchWithAuth(url, cobaltJwt);
  } catch (e) {
    return { ok: false, reason: `network error (jwt): ${(e as Error).message}`, via: 'jwt' };
  }

  let via: 'jwt' | 'cookie' = 'jwt';
  const needsCookieFallback =
    !raw.ok || looksLikeClaimRedirect(raw);

  if (needsCookieFallback) {
    if (!cobaltSession) {
      return {
        ok: false,
        reason: looksLikeClaimRedirect(raw)
          ? `jwt redirected to claim page (no cookie fallback available)`
          : `http ${raw.status} via jwt (no cookie fallback available)`,
        status: raw.status,
        via: 'jwt',
        finalUrl: raw.finalUrl,
        htmlSnippet: raw.body.slice(0, 240),
      };
    }
    try {
      const fallback = await rawFetchWithCookie(url, cobaltSession);
      if (!fallback.ok || looksLikeClaimRedirect(fallback)) {
        return {
          ok: false,
          reason: looksLikeClaimRedirect(fallback)
            ? `cookie also redirected to claim page (jwt did too)`
            : `http ${fallback.status} via cookie (jwt got ${raw.status})`,
          status: fallback.status,
          via: 'cookie',
          finalUrl: fallback.finalUrl,
          htmlSnippet: fallback.body.slice(0, 240),
        };
      }
      raw = fallback;
      via = 'cookie';
    } catch (e) {
      return {
        ok: false,
        reason: `cookie fallback errored: ${(e as Error).message}`,
        status: raw.status,
        via: 'jwt',
        finalUrl: raw.finalUrl,
        htmlSnippet: raw.body.slice(0, 240),
      };
    }
  }

  const parsed = parseMonsterHtml(raw.body, ddbId, url);
  if (!parsed) {
    return {
      ok: false,
      reason: `parser returned null (statBlock selectors did not match; bodyLen=${raw.body.length})`,
      status: raw.status,
      via,
      finalUrl: raw.finalUrl,
      htmlSnippet: raw.body.slice(0, 240),
    };
  }

  return { ok: true, via, data: parsed };
}

// ─── Magic item page ─────────────────────────────────────────────────────────

import { parseMagicItemHtml, type DdbMagicItemData } from './ddb-magic-item-parser';
export type { DdbMagicItemData } from './ddb-magic-item-parser';

export type FetchMagicItemResult =
  | { ok: true; data: DdbMagicItemData; via: 'jwt' | 'cookie' }
  | { ok: false; reason: string; via?: 'jwt' | 'cookie'; finalUrl?: string };

/**
 * Fetch a DDB magic item page. Mirrors fetchMonsterData's auth-fallback
 * pattern: try JWT first (fast, no cookie roundtrip), fall back to cookie
 * if the JWT path redirects or rejects.
 */
export async function fetchMagicItemData(
  ddbId: string,
  slug: string,
  cobaltJwt: string,
  cobaltSession?: string,
): Promise<FetchMagicItemResult> {
  const url = `https://www.dndbeyond.com/magic-items/${ddbId}-${slug}`;

  // (1) JWT path.
  try {
    const html = await fetchWithAuth(url, cobaltJwt);
    if (html.length > 500) {
      const parsed = parseMagicItemHtml(html, url, ddbId);
      if (parsed && parsed.name) {
        return { ok: true, via: 'jwt', data: parsed };
      }
    }
  } catch (e) {
    // fall through to cookie
    void e;
  }

  // (2) Cookie fallback.
  if (cobaltSession) {
    try {
      const html = await fetchWithCookie(url, cobaltSession);
      const parsed = parseMagicItemHtml(html, url, ddbId);
      if (parsed && parsed.name) {
        return { ok: true, via: 'cookie', data: parsed };
      }
      return { ok: false, reason: 'parse_empty', via: 'cookie', finalUrl: url };
    } catch (e) {
      return { ok: false, reason: `network error (cookie): ${(e as Error).message}`, via: 'cookie', finalUrl: url };
    }
  }

  return { ok: false, reason: 'jwt_parse_empty_no_cookie', via: 'jwt', finalUrl: url };
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
