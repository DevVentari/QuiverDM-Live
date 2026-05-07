import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, WorldEntryType } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  prisma: {
    worldEntry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));

import { worldRepository } from '@/server/repositories/world.repository';

describe('worldRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('findEntries', () => {
    it('queries by campaignId and returns entries', async () => {
      const entry = { id: 'e1', name: 'Bonfire Keep', slug: 'bonfire-keep', type: WorldEntryType.LOCATION, summary: null, tags: [], createdAt: new Date() };
      mocks.prisma.worldEntry.findMany.mockResolvedValue([entry]);

      const result = await worldRepository.findEntries('campaign-1');

      expect(mocks.prisma.worldEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { campaignId: 'campaign-1' } })
      );
      expect(result).toEqual([entry]);
    });

    it('filters by type when provided', async () => {
      mocks.prisma.worldEntry.findMany.mockResolvedValue([]);
      await worldRepository.findEntries('campaign-1', { type: WorldEntryType.MONSTER });
      expect(mocks.prisma.worldEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { campaignId: 'campaign-1', type: WorldEntryType.MONSTER } })
      );
    });

    it('adds search OR filter when search provided', async () => {
      mocks.prisma.worldEntry.findMany.mockResolvedValue([]);
      await worldRepository.findEntries('campaign-1', { search: 'keep' });
      const call = mocks.prisma.worldEntry.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });
  });

  describe('findEntryBySlug', () => {
    it('calls findUnique with campaignId_slug compound key', async () => {
      mocks.prisma.worldEntry.findUnique.mockResolvedValue(null);
      await worldRepository.findEntryBySlug('campaign-1', 'bonfire-keep');
      expect(mocks.prisma.worldEntry.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId_slug: { campaignId: 'campaign-1', slug: 'bonfire-keep' } },
        })
      );
    });
  });

  describe('upsertEntry', () => {
    it('upserts by campaignId_slug and returns entry', async () => {
      const entry = { id: 'e1', name: 'Keep', slug: 'keep', type: WorldEntryType.LOCATION };
      mocks.prisma.worldEntry.upsert.mockResolvedValue(entry);

      const result = await worldRepository.upsertEntry('campaign-1', {
        type: WorldEntryType.LOCATION,
        name: 'Keep',
        slug: 'keep',
        content: '# Keep\n\nA place.',
      });

      expect(mocks.prisma.worldEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId_slug: { campaignId: 'campaign-1', slug: 'keep' } },
        })
      );
      expect(result).toEqual(entry);
    });

    it('passes Prisma.JsonNull for structuredData when not provided', async () => {
      mocks.prisma.worldEntry.upsert.mockResolvedValue({});
      await worldRepository.upsertEntry('campaign-1', {
        type: WorldEntryType.LOCATION,
        name: 'Keep',
        slug: 'keep',
        content: '# Keep',
      });
      const call = mocks.prisma.worldEntry.upsert.mock.calls[0][0];
      expect(call.create.structuredData).toBe(Prisma.JsonNull);
      expect(call.update.structuredData).toBe(Prisma.JsonNull);
    });
  });

  describe('linkToWorldEntity', () => {
    it('updates worldEntityId on the entry', async () => {
      mocks.prisma.worldEntry.update.mockResolvedValue({});
      await worldRepository.linkToWorldEntity('entry-1', 'entity-1');
      expect(mocks.prisma.worldEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { worldEntityId: 'entity-1' },
      });
    });
  });
});
