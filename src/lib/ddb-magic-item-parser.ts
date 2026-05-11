/**
 * Magic-item page parser for D&D Beyond `/magic-items/<id>-<slug>` URLs.
 *
 * Mirrors the shape of `ddb-monster-parser.ts` — fetch one item page, return
 * a structured `DdbMagicItemData` row with name, rarity, type, description,
 * and the canonical item image URL. The DDB sync pipeline writes the result
 * into HomebrewContent via the existing `upsertItem` sink call.
 */

import * as cheerio from 'cheerio';

export interface DdbMagicItemData {
  ddbId: string;
  name: string;
  rarity?: string;
  itemType?: string;
  attunement?: string;
  description: string;
  imageUrl?: string;
  source?: string;
  sourceUrl: string;
}

function normUrl(src: string | undefined): string | undefined {
  if (!src) return undefined;
  return src.startsWith('//') ? `https:${src}` : src;
}

export function parseMagicItemHtml(
  html: string,
  url: string,
  ddbId: string,
): DdbMagicItemData | null {
  const $ = cheerio.load(html);

  const name =
    $('.page-title').first().text().trim() ||
    $('h1.item-name').first().text().trim() ||
    $('header h1').first().text().trim();
  if (!name) return null;

  // Rarity + type live in the "item-info" / "description-callout" line. DDB
  // formats it like "Wondrous Item, very rare (requires attunement)".
  const callout =
    $('.details-aside .description-callout-text').first().text().replace(/\s+/g, ' ').trim() ||
    $('.more-info-content .details-info-line').first().text().replace(/\s+/g, ' ').trim() ||
    '';

  let itemType: string | undefined;
  let rarity: string | undefined;
  let attunement: string | undefined;
  if (callout) {
    const attnMatch = callout.match(/\((requires? [^)]+)\)/i);
    if (attnMatch) attunement = attnMatch[1];
    const cleaned = callout.replace(/\([^)]*\)/g, '').trim();
    const parts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 1) itemType = parts[0];
    if (parts.length >= 2) rarity = parts[1];
  }

  const description =
    $('.more-info-content').first().text().replace(/\s+/g, ' ').trim() ||
    $('.item-description').first().text().replace(/\s+/g, ' ').trim() ||
    '';

  const imageUrl = normUrl(
    $('.details-aside .image img, .item-image img, .magic-item-image img').first().attr('src') ||
      undefined,
  );

  const source = $('.item-source, .monster-source').first().text().replace(/\s+/g, ' ').trim() || undefined;

  return {
    ddbId,
    name,
    rarity,
    itemType,
    attunement,
    description,
    imageUrl,
    source,
    sourceUrl: url,
  };
}
