/**
 * Lean D&D Beyond client for party import. Endpoint-for-endpoint mirror of
 * src/lib/dndbeyond-api.ts in the main app (fetchDDBCampaignCharacters /
 * fetchCharacterFromDDB) — kept forge-local to avoid cross-root imports.
 * Full extraction into @quiverdm/shared is a later consolidation.
 */
const CRAWL4AI_URL = process.env.CRAWL4AI_URL ?? 'http://192.168.1.21:5002';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface DdbClient {
  fetchCampaignCharacterIds(campaignUrl: string, cobalt: string): Promise<{ ok: boolean; ids?: string[]; message?: string }>;
  fetchCharacterName(characterId: string, cobalt: string): Promise<string | null>;
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
  async fetchCampaignCharacterIds(campaignUrl, cobalt) {
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
    if (!crawl.success || !crawl.character_ids?.length) {
      return { ok: false, message: crawl.message ?? 'No characters found on the campaign page.' };
    }
    return { ok: true, ids: crawl.character_ids.map(String) };
  },

  async fetchCharacterName(characterId, cobalt) {
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
      if (!res.ok) return null;
      const name = (await res.json())?.data?.name;
      return typeof name === 'string' && name.trim() ? name.trim() : null;
    } catch {
      return null;
    }
  },
};
