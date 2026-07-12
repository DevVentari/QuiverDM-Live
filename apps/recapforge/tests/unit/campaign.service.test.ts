import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  slugify, createForgeCampaign, listForgeCampaigns, addPartyMember, listParty, removePartyMember,
} from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `camp-${Date.now()}@recapforge-test.local`;
let userId: string;
let campaignId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Camp Test' } })).id;
});

afterAll(async () => {
  if (campaignId) await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('campaign.service', () => {
  it('slugifies', () => {
    expect(slugify('Tales from The Bonfire Keep!')).toBe('tales-from-the-bonfire-keep');
    expect(slugify('***')).toBe('campaign');
  });

  it('creates a recapforge-flagged campaign with an OWNER member', async () => {
    const c = await createForgeCampaign(prisma, userId, 'Test Chronicle');
    campaignId = c.id;
    expect(c.slug).toMatch(/^test-chronicle-[0-9a-f]{6}$/);
    const member = await prisma.campaignMember.findFirst({ where: { campaignId: c.id, userId } });
    expect(member?.role).toBe('OWNER');
    const mine = await listForgeCampaigns(prisma, userId);
    expect(mine.map((m) => m.id)).toContain(c.id);
  });

  it('adds a party member and seeds the lexicon', async () => {
    await addPartyMember(prisma, userId, { campaignId, playerName: 'Dana', characterName: "Kah'Roak" });
    const party = await listParty(prisma, userId, campaignId);
    expect(party.some((p) => p.characterName === "Kah'Roak")).toBe(true);
    const term = await prisma.lexiconTerm.findUnique({
      where: { campaignId_term: { campaignId, term: "Kah'Roak" } },
    });
    expect(term).toMatchObject({ kind: 'pc', source: 'manual' });
  });

  it('strikes a member from the party and re-files their lexicon term as npc', async () => {
    await addPartyMember(prisma, userId, { campaignId, playerName: 'Blake', characterName: 'Listertest' });
    const party = await listParty(prisma, userId, campaignId);
    const member = party.find((p) => p.characterName === 'Listertest')!;
    await removePartyMember(prisma, userId, { campaignId, playerId: member.id });
    const after = await listParty(prisma, userId, campaignId);
    expect(after.some((p) => p.characterName === 'Listertest')).toBe(false);
    const term = await prisma.lexiconTerm.findUnique({
      where: { campaignId_term: { campaignId, term: 'Listertest' } },
    });
    expect(term?.kind).toBe('npc'); // name still boosts transcription
    // striking again is a no-op, not an error
    await removePartyMember(prisma, userId, { campaignId, playerId: member.id });
  });

  it('refuses a non-owner', async () => {
    const stranger = await prisma.user.create({ data: { email: `s-${EMAIL}`, name: 'S' } });
    await expect(
      addPartyMember(prisma, stranger.id, { campaignId, playerName: 'X', characterName: 'Y' }),
    ).rejects.toThrow();
    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
