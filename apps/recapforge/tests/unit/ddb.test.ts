import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { parseCardMeta, type DdbClient } from '@/lib/ddb';
import { createForgeCampaign, importPartyFromDdb } from '@/server/services/campaign.service';
import { setCobalt } from '@/server/services/keys.service';

const prisma = new PrismaClient();
const EMAIL = `ddb-${Date.now()}@recapforge-test.local`;
let userId: string;
let campaignId: string;
let fallbackCampaignId: string;

/** Roster path: cards carry everyone — including the private character with no id. */
const rosterDdb: DdbClient = {
  fetchCampaignRoster: async () => ({
    ok: true,
    ids: ['111', '222'],
    entries: [
      { id: '111', name: 'Oriyan Vale', meta: 'Lvl 12 | Human | Wizard / Chronicler', playerUsername: 'NobleECT088' },
      { id: '222', name: 'Whisperwick Quickclaw', meta: null, playerUsername: null },
      { id: null, name: 'Edrin Valric', meta: 'Lvl 12 | Human | Artificer / Wizard / School of Transmutation', playerUsername: 'Rawrycopter' },
    ],
  }),
  fetchCharacterSummary: async () => {
    throw new Error('roster path must not fetch sheets');
  },
};

/** Fallback path: no cards (markup drift), ids only; one sheet unreadable. */
const fallbackDdb: DdbClient = {
  fetchCampaignRoster: async () => ({ ok: true, ids: ['111', '222', '333'], entries: [] }),
  fetchCharacterSummary: async (id) =>
    id === '333' ? null : id === '111' ? { name: 'Oriyan Vale', className: 'Wizard / Chronicler' } : { name: 'Whisperwick Quickclaw', className: null },
};

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'DDB Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'DDB Import Test')).id;
  fallbackCampaignId = (await createForgeCampaign(prisma, userId, 'DDB Fallback Test')).id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: { in: [campaignId, fallbackCampaignId] } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('parseCardMeta', () => {
  it.each([
    ['Lvl 12 | Human | Artificer / Wizard / School of Transmutation', 12, 'Human', 'Artificer / Wizard / School of Transmutation'],
    ['Lvl 12 | Lupin | Blood Hunter / Order of the Lycan', 12, 'Lupin', 'Blood Hunter / Order of the Lycan'],
    ['Lvl 3 | Warforged | Paladin', 3, 'Warforged', 'Paladin'],
  ])('%s', (meta, level, race, className) => {
    expect(parseCardMeta(meta)).toEqual({ level, race, className });
  });

  it('handles partial and empty lines', () => {
    expect(parseCardMeta(null)).toEqual({ level: null, race: null, className: null });
    expect(parseCardMeta('Lvl 5')).toEqual({ level: 5, race: null, className: null });
    expect(parseCardMeta('Sorcerer / Draconic Sorcery')).toEqual({ level: null, race: null, className: 'Sorcerer / Draconic Sorcery' });
    // unclaimed slots must not get "Unassigned" as a class
    expect(parseCardMeta('Unassigned')).toEqual({ level: null, race: null, className: null });
  });
});

describe('importPartyFromDdb', () => {
  it('refuses without a cobalt cookie', async () => {
    await expect(
      importPartyFromDdb(prisma, rosterDdb, userId, { campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345' }),
    ).rejects.toThrow(/cobalt/i);
  });

  it('roster path: imports everyone incl. the private character, with class/race/level/player', async () => {
    await setCobalt(prisma, userId, 'a-valid-looking-cobalt-cookie-value');
    const res = await importPartyFromDdb(prisma, rosterDdb, userId, {
      campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(res).toEqual({ imported: 3, failed: 0 });
    const party = await prisma.player.findMany({ where: { campaignId }, orderBy: { characterName: 'asc' } });
    expect(party.map((p) => p.characterName)).toEqual(['Edrin Valric', 'Oriyan Vale', 'Whisperwick Quickclaw']);
    const edrin = party.find((p) => p.characterName === 'Edrin Valric')!;
    expect(edrin).toMatchObject({
      name: 'Rawrycopter',
      characterClass: 'Artificer / Wizard / School of Transmutation',
      characterRace: 'Human',
      level: 12,
      dndBeyondUrl: null, // private — no sheet link on the card
    });
    const term = await prisma.lexiconTerm.findUnique({
      where: { campaignId_term: { campaignId, term: 'Edrin Valric' } },
    });
    expect(term?.source).toBe('ddb-import');
  });

  it('roster path is idempotent and refreshes context on re-import', async () => {
    const res = await importPartyFromDdb(prisma, rosterDdb, userId, {
      campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(res.imported).toBe(3);
    expect(await prisma.player.count({ where: { campaignId } })).toBe(3); // no dupes
  });

  it('re-import respects a struck member (lexicon kind npc) — no resurrection', async () => {
    // Strike Whisperwick: remove the Player row, demote the lexicon term.
    await prisma.player.deleteMany({ where: { campaignId, characterName: 'Whisperwick Quickclaw' } });
    await prisma.lexiconTerm.update({
      where: { campaignId_term: { campaignId, term: 'Whisperwick Quickclaw' } },
      data: { kind: 'npc' },
    });
    await importPartyFromDdb(prisma, rosterDdb, userId, {
      campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(await prisma.player.count({ where: { campaignId, characterName: 'Whisperwick Quickclaw' } })).toBe(0);
    expect(await prisma.player.count({ where: { campaignId } })).toBe(2);
  });

  it('fallback path: per-sheet fetch when cards are empty; unreadable sheets count as failed', async () => {
    const res = await importPartyFromDdb(prisma, fallbackDdb, userId, {
      campaignId: fallbackCampaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(res).toEqual({ imported: 2, failed: 1 });
    const party = await prisma.player.findMany({ where: { campaignId: fallbackCampaignId } });
    expect(party.map((p) => p.characterName).sort()).toEqual(['Oriyan Vale', 'Whisperwick Quickclaw']);
  });
});
