import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';

const { addBrainIngestionJob } = vi.hoisted(() => ({
  addBrainIngestionJob: vi.fn(),
}));

vi.mock('@/lib/queue/brain-ingestion-queue', () => ({
  addBrainIngestionJob,
}));

import { brainService } from '@/server/services/brain.service';

describe('brain.seedFromCreation', () => {
  let campaignId: string;
  let userId: string;

  beforeEach(async () => {
    addBrainIngestionJob.mockReset();
    addBrainIngestionJob.mockResolvedValue(undefined);

    const user = await prisma.user.create({
      data: { email: `brain-seed-test-${Date.now()}@test.local` },
    });
    userId = user.id;

    const campaign = await prisma.campaign.create({
      data: { name: 'Test Seed Campaign', slug: `test-seed-${Date.now()}`, userId },
    });
    campaignId = campaign.id;
  });

  afterEach(async () => {
    await prisma.worldStateChange.deleteMany({ where: { campaignId } });
    await prisma.worldRelationship.deleteMany({ where: { campaignId } });
    await prisma.worldEntity.deleteMany({ where: { campaignId } });
    await prisma.worldState.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('creates entities, hooks, and ingestion jobs from creation input', async () => {
    await brainService.seedFromCreation(campaignId, userId, {
      worldSetup: {
        startingLocation: 'Waterdeep',
        antagonistName: 'Xanathar',
        antagonistMotivation: 'Seize the cache of dragons',
        openingHook: 'A tavern brawl pulls the party into a citywide conspiracy.',
        factions: [
          { name: 'Harpers', stance: 'ally' },
          { name: "Xanathar's Guild", stance: 'hostile' },
        ],
      },
      storyText: 'The campaign opens in Waterdeep after rumors of hidden gold spread.',
    });

    const entities = await prisma.worldEntity.findMany({
      where: { campaignId },
      orderBy: { name: 'asc' },
    });
    const state = await prisma.worldState.findUnique({ where: { campaignId } });

    expect(entities.some((e) => e.name === 'Waterdeep' && e.type === 'LOCATION')).toBe(true);
    expect(
      entities.some(
        (e) =>
          e.name === 'Xanathar' &&
          e.type === 'THREAT' &&
          e.description?.includes('cache of dragons')
      )
    ).toBe(true);
    expect(
      entities.some(
        (e) =>
          e.name === 'Harpers' &&
          e.type === 'FACTION' &&
          (e.properties as Record<string, unknown>)?.stance === 'ally'
      )
    ).toBe(true);
    expect(Array.isArray(state?.hooks)).toBe(true);
    expect(
      (state?.hooks as Array<{ text: string }>).some((hook) =>
        hook.text.includes('citywide conspiracy')
      )
    ).toBe(true);
    expect(addBrainIngestionJob).toHaveBeenCalledWith({
      campaignId,
      sessionId: null,
      summary: 'The campaign opens in Waterdeep after rumors of hidden gold spread.',
      highlights: [],
      source: 'campaign_creation',
    });
  });

  it('rejects non-owners', async () => {
    await expect(
      brainService.seedFromCreation(campaignId, 'not-the-owner', {
        worldSetup: { startingLocation: 'Neverwinter' },
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
