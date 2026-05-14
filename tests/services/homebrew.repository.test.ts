import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    homebrewContent: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));

import {
  findContent,
  findByType,
  getStats,
} from '@/server/repositories/homebrew.repository';

describe('homebrewRepository campaign scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.homebrewContent.findMany.mockResolvedValue([]);
    mocks.prisma.homebrewContent.groupBy.mockResolvedValue([]);
    mocks.prisma.homebrewContent.count.mockResolvedValue(0);
  });

  it('findContent only uses explicit campaign links', async () => {
    await findContent({
      userId: 'user-1',
      campaignId: 'campaign-1',
      limit: 20,
    });

    expect(mocks.prisma.homebrewContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          campaigns: { some: { campaignId: 'campaign-1' } },
        }),
      }),
    );
  });

  it('findByType only uses explicit campaign links', async () => {
    await findByType({
      userId: 'user-1',
      type: 'creature',
      campaignId: 'campaign-1',
    });

    expect(mocks.prisma.homebrewContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          type: 'creature',
          campaigns: { some: { campaignId: 'campaign-1' } },
        },
      }),
    );
  });

  it('getStats only uses explicit campaign links', async () => {
    await getStats({
      userId: 'user-1',
      campaignId: 'campaign-1',
    });

    expect(mocks.prisma.homebrewContent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          campaigns: { some: { campaignId: 'campaign-1' } },
        },
      }),
    );
    expect(mocks.prisma.homebrewContent.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        campaigns: { some: { campaignId: 'campaign-1' } },
      },
    });
  });
});
