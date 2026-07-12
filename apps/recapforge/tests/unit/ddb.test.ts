import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { DdbClient } from '@/lib/ddb';
import { createForgeCampaign, importPartyFromDdb } from '@/server/services/campaign.service';
import { setCobalt } from '@/server/services/keys.service';

const prisma = new PrismaClient();
const EMAIL = `ddb-${Date.now()}@recapforge-test.local`;
let userId: string;
let campaignId: string;

const fakeDdb: DdbClient = {
  fetchCampaignCharacterIds: async () => ({ ok: true, ids: ['111', '222', '333'] }),
  fetchCharacterName: async (id) => (id === '333' ? null : id === '111' ? 'Oriyan Vale' : 'Whisperwick Quickclaw'),
};

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'DDB Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'DDB Import Test')).id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('importPartyFromDdb', () => {
  it('refuses without a cobalt cookie', async () => {
    await expect(
      importPartyFromDdb(prisma, fakeDdb, userId, { campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345' }),
    ).rejects.toThrow(/cobalt/i);
  });

  it('imports named characters, skips unnamed, seeds lexicon', async () => {
    await setCobalt(prisma, userId, 'a-valid-looking-cobalt-cookie-value');
    const res = await importPartyFromDdb(prisma, fakeDdb, userId, {
      campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(res).toEqual({ imported: 2, failed: 1 });
    const party = await prisma.player.findMany({ where: { campaignId } });
    expect(party.map((p) => p.characterName).sort()).toEqual(['Oriyan Vale', 'Whisperwick Quickclaw']);
    const term = await prisma.lexiconTerm.findUnique({
      where: { campaignId_term: { campaignId, term: 'Oriyan Vale' } },
    });
    expect(term?.source).toBe('ddb-import');
  });

  it('is idempotent on characterName', async () => {
    const res = await importPartyFromDdb(prisma, fakeDdb, userId, {
      campaignId, campaignUrl: 'https://www.dndbeyond.com/campaigns/12345',
    });
    expect(res.imported).toBe(2);
    expect(await prisma.player.count({ where: { campaignId } })).toBe(2); // no dupes
  });
});
