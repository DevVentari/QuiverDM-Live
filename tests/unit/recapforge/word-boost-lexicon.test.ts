import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getCampaignWordBoost } from '@/lib/transcription/assemblyai';

const prisma = new PrismaClient();
let campaignId: string;
const EMAIL = `wb-${Date.now()}@recapforge-test.local`;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: EMAIL, name: 'WB' } });
  const c = await prisma.campaign.create({
    data: { name: 'WB Test', slug: `wb-${Date.now()}`, userId: user.id, settings: { recapforge: true } },
  });
  campaignId = c.id;
  await prisma.lexiconTerm.create({ data: { campaignId, term: "Kah'Roak", aliases: ['Kahroak'], kind: 'pc', source: 'manual' } });
  await prisma.player.create({ data: { campaignId, name: 'Dana', characterName: 'The Beast of Snarlswood' } });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('getCampaignWordBoost — forge branch', () => {
  it('includes lexicon terms, aliases, and player character names', async () => {
    const boost = await getCampaignWordBoost(campaignId);
    expect(boost).toContain("Kah'Roak");
    expect(boost).toContain('Kahroak');
    expect(boost).toContain('The Beast of Snarlswood');
    expect(boost).toContain('initiative'); // base D&D terms still present
  });
});
