import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    worldSimulationEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));

import { worldSimulationRepository } from '@/server/repositories/world-simulation.repository';

describe('worldSimulationRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getSessionSeed', () => {
    it('returns recent world proposal and threshold events for the campaign', async () => {
      mocks.prisma.worldSimulationEvent.findMany.mockResolvedValue([]);

      await worldSimulationRepository.getSessionSeed('campaign-1', 5);

      expect(mocks.prisma.worldSimulationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: 'campaign-1',
            type: {
              in: ['world_proposal', 'threshold_trigger'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      );
    });
  });
});
