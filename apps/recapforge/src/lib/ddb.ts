/**
 * Lean D&D Beyond client for party import. Endpoint-for-endpoint mirror of
 * src/lib/dndbeyond-api.ts in the main app (fetchDDBCampaignCharacters /
 * fetchCharacterFromDDB), including its crawl4ai private-character fallback
 * (fetchCharacterViaBrowser) — kept forge-local to avoid cross-root imports.
 * Full extraction into @quiverdm/shared is a later consolidation.
 *
 * RecapForge deliberately does NOT import full character sheets — only the
 * name and class line, as context for the scribe (recaps, wiki, lexicon).
 */
const CRAWL4AI_URL = process.env.CRAWL4AI_URL ?? 'http://192.168.1.21:5002';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface DdbCharacterSummary {
  name: string;
  /** e.g. "Cleric / War Domain" or "Fighter / Wizard" for multiclass; null when unreadable */
  className: string | null;
}

export interface DdbRosterEntry {
  /** null for private characters — the roster card has no sheet link */
  id: string | null;
  name: string;
  /** raw card meta line, e.g. "Lvl 12 | Human | Artificer / Wizard / School of Transmutation" */
  meta: string | null;
  playerUsername: string | null;
}

export interface DdbClient {
  /** The campaign roster: names/classes/players for EVERY character, private or not. */
  fetchCampaignRoster(campaignUrl: string, cobalt: string): Promise<{ ok: boolean; entries?: DdbRosterEntry[]; ids?: string[]; message?: string }>;
  /** Per-sheet fallback, used only when the roster cards come back empty. */
  fetchCharacterSummary(characterId: string, cobalt: string): Promise<DdbCharacterSummary | null>;
}

/** Parse a roster card's meta line: "Lvl 12 | Human | Artificer / Wizard / …". */
export function parseCardMeta(meta: string | null): { level: number | null; race: string | null; className: string | null } {
  // Unclaimed character slots render "Unassigned" where the meta line goes.
  if (!meta || /^unassigned$/i.test(meta.trim())) return { level: null, race: null, className: null };
  const parts = meta.split('|').map((s) => s.trim()).filter(Boolean);
  let level: number | null = null;
  const rest: string[] = [];
  for (const part of parts) {
    const lvl = part.match(/^(?:lvl|level)\s*(\d+)$/i);
    if (lvl && level === null) level = parseInt(lvl[1], 10);
    else rest.push(part);
  }
  // Card order is "Lvl | Race | Classes" — with both present, first is race,
  // last is the class list; with only one, it's the class list.
  if (rest.length >= 2) return { level, race: rest[0], className: rest.slice(1).join(' | ') };
  return { level, race: null, className: rest[0] ?? null };
}

/**
 * Extract the summary from a raw character-service `data` object.
 * classes[]: definition.name plus subclassDefinition.name when present.
 */
function summarize(data: unknown): DdbCharacterSummary | null {
  const d = data as { name?: unknown; classes?: Array<{ definition?: { name?: string }; subclassDefinition?: { name?: string } | null }> } | null;
  const name = typeof d?.name === 'string' && d.name.trim() ? d.name.trim() : null;
  if (!name) return null;
  const parts: string[] = [];
  for (const c of d?.classes ?? []) {
    if (c?.definition?.name) parts.push(c.definition.name);
    if (c?.subclassDefinition?.name) parts.push(c.subclassDefinition.name);
  }
  return { name, className: parts.length ? parts.join(' / ') : null };
}

/**
 * Fallback for private characters: use the crawl4ai service to render the
 * DDB character page as the DM and intercept the character-service XHR.
 * Only called when the direct API returns 403/401. Mirrors
 * fetchCharacterViaBrowser in src/lib/dndbeyond-api.ts.
 */
async function fetchCharacterSummaryViaBrowser(characterId: string, cobalt: string): Promise<DdbCharacterSummary | null> {
  try {
    const res = await fetch(`${CRAWL4AI_URL}/character/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: characterId, cobalt_session: cobalt }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const result = await res.json();
    if (!result.success) return null;
    // crawl4ai returns data = the intercepted character-service envelope,
    // so the character itself is one level deeper (data.data) — same
    // unwrap the main app's parseCharacterData does on this payload.
    return summarize(result.data?.data);
  } catch {
    return null;
  }
}

async function getBearerToken(cobalt: string): Promise<string | null> {
  try {
    const res = await fetch('https://auth-service.dndbeyond.com/v1/cobalt-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `CobaltSession=${cobalt}` },
    });
    if (!res.ok) return null;
    return (await res.json())?.token ?? null;
  } catch {
    return null;
  }
}

export const ddbClient: DdbClient = {
  async fetchCampaignRoster(campaignUrl, cobalt) {
    const match = campaignUrl.match(/\/campaigns\/(\d+)/);
    if (!match) return { ok: false, message: 'Could not parse a campaign ID from that URL.' };
    const campaignId = match[1];

    const bearer = await getBearerToken(cobalt);
    if (!bearer) return { ok: false, message: 'Your cobalt cookie looks expired — re-paste it in Workings.' };

    const listRes = await fetch('https://www.dndbeyond.com/api/campaign/stt/user-campaigns', {
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
        Cookie: `CobaltSession=${cobalt}`,
      },
    });
    if (!listRes.ok) {
      return { ok: false, message: listRes.status === 401 || listRes.status === 403 ? 'Your cobalt cookie looks expired — re-paste it in Workings.' : `D&D Beyond returned ${listRes.status}.` };
    }
    const campaigns: Array<{ id: number | string }> = (await listRes.json())?.data ?? [];
    if (!campaigns.some((c) => String(c.id) === campaignId)) {
      return { ok: false, message: `Campaign ${campaignId} was not found in your D&D Beyond account.` };
    }

    const crawlRes = await fetch(`${CRAWL4AI_URL}/campaign/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, cobalt_session: cobalt }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!crawlRes.ok) return { ok: false, message: `Character lookup service error: ${crawlRes.statusText}` };
    const crawl = await crawlRes.json();
    const ids: string[] = (crawl.character_ids ?? []).map(String);
    const entries: DdbRosterEntry[] = (crawl.characters ?? [])
      .filter((c: { name?: unknown }) => typeof c?.name === 'string' && (c.name as string).trim())
      .map((c: { id?: string | null; name: string; meta?: string | null; player_username?: string | null }) => ({
        id: c.id ? String(c.id) : null,
        name: c.name.trim(),
        meta: c.meta ?? null,
        playerUsername: c.player_username ?? null,
      }));
    if (!crawl.success || (ids.length === 0 && entries.length === 0)) {
      return { ok: false, message: crawl.message ?? 'No characters found on the campaign page.' };
    }
    return { ok: true, ids, entries };
  },

  async fetchCharacterSummary(characterId, cobalt) {
    try {
      const res = await fetch(
        `https://character-service.dndbeyond.com/character/v5/character/${characterId}?includeCustomItems=true`,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': UA,
            Origin: 'https://www.dndbeyond.com',
            Referer: 'https://www.dndbeyond.com/',
            Cookie: `CobaltSession=${cobalt}`,
          },
        },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return fetchCharacterSummaryViaBrowser(characterId, cobalt);
        }
        return null;
      }
      return summarize((await res.json())?.data);
    } catch {
      return null;
    }
  },
};
