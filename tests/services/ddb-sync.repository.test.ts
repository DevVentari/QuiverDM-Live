import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    ddbEntitlement: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    ddbSourcebook: {
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignSourcebook: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    ddbSourcebookChapter: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    homebrewContent: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignHomebrewContent: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    worldEntity: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sourcebookEntity: {
      findMany: vi.fn(),
    },
    encounterPlan: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';

describe('ddbSyncRepository.seedCampaignFromSourcebook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(mocks.prisma));
    mocks.prisma.ddbSourcebookChapter.findMany.mockResolvedValue([{ id: 'chapter-1' }]);
    mocks.prisma.homebrewContent.findMany.mockResolvedValue([
      {
        id: 'canonical-creature-1',
        type: 'creature',
        name: 'Strahd von Zarovich',
        data: { ac: 16, hp: 144 },
        images: ['https://img.example/strahd.png'],
        tags: ['cos'],
        searchText: 'Strahd stat block',
        dndBeyondId: 'ddb-1',
        dndBeyondUrl: 'https://www.dndbeyond.com/monsters/strahd',
        ddbChapterId: 'chapter-1',
        imageUrl: 'https://img.example/strahd.png',
      },
    ]);
    mocks.prisma.campaignHomebrewContent.findMany.mockResolvedValue([]);
    mocks.prisma.homebrewContent.create.mockResolvedValue({ id: 'campaign-creature-1' });
    mocks.prisma.campaignHomebrewContent.upsert.mockResolvedValue({});
    mocks.prisma.worldEntity.findMany.mockResolvedValue([]);
    mocks.prisma.sourcebookEntity.findMany.mockResolvedValue([
      {
        type: 'NPC',
        name: 'Strahd von Zarovich',
        description: 'The vampire lord of Barovia.',
        properties: {},
        aliases: [],
        status: 'active',
        chapterId: 'chapter-1',
        sourceType: 'dndbeyond_import',
        confidence: 1,
        imageUrl: 'https://img.example/strahd-portrait.png',
        statBlockId: 'canonical-creature-1',
        statBlock: {
          dndBeyondId: 'ddb-1',
          ddbChapterId: 'chapter-1',
          type: 'creature',
          name: 'Strahd von Zarovich',
        },
      },
    ]);
    mocks.prisma.worldEntity.createMany.mockResolvedValue({ count: 1 });
  });

  it('clones canonical homebrew into the campaign and remaps stat blocks', async () => {
    const result = await ddbSyncRepository.seedCampaignFromSourcebook(
      'campaign-1',
      'sourcebook-1',
      'user-1',
    );

    expect(mocks.prisma.homebrewContent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Strahd von Zarovich',
          sourceType: 'sourcebook_seed',
          dndBeyondId: 'ddb-1',
        }),
      }),
    );
    expect(mocks.prisma.campaignHomebrewContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          campaignId: 'campaign-1',
          homebrewId: 'campaign-creature-1',
        },
      }),
    );
    expect(mocks.prisma.worldEntity.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            campaignId: 'campaign-1',
            name: 'Strahd von Zarovich',
            statBlockId: 'campaign-creature-1',
          }),
        ],
      }),
    );
    expect(result).toEqual({
      entitiesSeeded: 1,
      npcsSeeded: 1,
      source: 'master',
      donorCampaignId: null,
    });
  });
});
