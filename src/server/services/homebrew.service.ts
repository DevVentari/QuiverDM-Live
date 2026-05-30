import { TRPCError } from '@trpc/server';
import { homebrewRepository } from '../repositories/homebrew.repository';
import { authz } from './authorization.service';
import { indexHomebrew, deleteHomebrew, searchHomebrew } from '@/lib/search';
import { prisma } from '../db';

export class HomebrewService {
  async createContent(
    userId: string,
    input: {
      type: string;
      name: string;
      data: any;
      images?: string[];
      tags?: string[];
      addToCampaignId?: string;
      sourceType: string;
      dndBeyondId?: string;
      dndBeyondUrl?: string;
    }
  ) {
    const searchText = `${input.name} ${JSON.stringify(input.data)}`;

    const content = await homebrewRepository.createContent({
      userId,
      type: input.type,
      name: input.name,
      data: input.data,
      images: input.images ?? [],
      tags: input.tags ?? [],
      searchText,
      sourceType: input.sourceType,
      dndBeyondId: input.dndBeyondId,
      dndBeyondUrl: input.dndBeyondUrl,
    });

    if (input.addToCampaignId) {
      await authz
        .campaign(input.addToCampaignId, userId)
        .requireOwner();
      await homebrewRepository.addContentToCampaign({
        campaignId: input.addToCampaignId,
        homebrewId: content.id,
      });
    }

    void indexHomebrew({
      id: content.id,
      userId: content.userId,
      name: content.name,
      type: content.type,
      tags: content.tags,
      searchText,
      sourceType: input.sourceType,
    });

    return content;
  }

  async getContent(
    userId: string,
    input: {
      campaignId?: string;
      type?: string;
      search?: string;
      tags?: string[];
      limit: number;
      cursor?: string;
    }
  ) {
    const campaignAccess = input.campaignId
      ? await authz.campaign(input.campaignId, userId).verify()
      : null;
    const sharedOnly = Boolean(campaignAccess && !campaignAccess.isDM);

    // When a search term is provided, use MeiliSearch for relevance ranking.
    // Fall back to Postgres if MeiliSearch is unavailable.
    if (input.search && !input.campaignId) {
      try {
        const ids = await searchHomebrew(
          input.search,
          { userId, type: input.type, tags: input.tags },
          { limit: input.limit }
        );
        if (ids.length > 0) {
          const items = await homebrewRepository.findByIds(ids);
          return { items, nextCursor: undefined };
        }
        // ids.length === 0: item may not be indexed yet (async) — fall through to Postgres
      } catch {
        // MeiliSearch unavailable — fall through to Postgres
      }
    }

    const content = await homebrewRepository.findContent({
      userId,
      type: input.type,
      search: input.search,
      tags: input.tags,
      campaignId: input.campaignId,
      sharedOnly,
      limit: input.limit,
      cursor: input.cursor,
    });

    let nextCursor: string | undefined = undefined;
    if (content.length > input.limit) {
      const nextItem = content.pop();
      nextCursor = nextItem!.id;
    }

    return {
      items: content,
      nextCursor,
    };
  }

  async getContentById(id: string, userId: string) {
    const content = await homebrewRepository.findById(id);

    if (!content) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Homebrew content not found' });
    }

    // Owner can always read their own content
    if (content.userId === userId) {
      return content;
    }

    // Non-owners may read if the item is shared in a campaign they belong to
    const prismaAny = prisma as any;
    const sharedAccess = await prismaAny.campaignHomebrewContent.findFirst({
      where: {
        homebrewId: id,
        homebrew: { sharedWithPlayers: true },
        campaign: { members: { some: { userId } } },
      },
    });

    if (!sharedAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    return content;
  }

  async updateContent(
    userId: string,
    input: {
      id: string;
      name?: string;
      data?: any;
      images?: string[];
      tags?: string[];
    }
  ) {
    await authz.homebrew(input.id, userId).verify();

    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.data !== undefined) updateData.data = input.data;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.tags !== undefined) updateData.tags = input.tags;

    if (input.name !== undefined || input.data !== undefined) {
      const existing = await homebrewRepository.findById(input.id);
      const name = input.name ?? existing!.name;
      const data = input.data ?? existing!.data;
      updateData.searchText = `${name} ${JSON.stringify(data)}`;
    }

    const updated = await homebrewRepository.updateContent(input.id, updateData);

    void indexHomebrew({
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      type: updated.type,
      tags: updated.tags,
      searchText: updated.searchText,
      sourceType: updated.sourceType,
    });

    return updated;
  }

  async deleteContent(userId: string, id: string) {
    await authz.homebrew(id, userId).verify();
    await homebrewRepository.deleteContent(id);
    void deleteHomebrew(id);
    return { success: true };
  }

  async getContentByType(
    userId: string,
    input: { type: string; campaignId?: string }
  ) {
    const campaignAccess = input.campaignId
      ? await authz.campaign(input.campaignId, userId).verify()
      : null;
    return homebrewRepository.findByType({
      userId,
      type: input.type,
      campaignId: input.campaignId,
      sharedOnly: Boolean(campaignAccess && !campaignAccess.isDM),
    });
  }

  async getContentStats(userId: string, campaignId?: string) {
    const campaignAccess = campaignId
      ? await authz.campaign(campaignId, userId).verify()
      : null;
    const { stats, total } = await homebrewRepository.getStats({
      userId,
      campaignId,
      sharedOnly: Boolean(campaignAccess && !campaignAccess.isDM),
    });

    return {
      total,
      byType: stats.reduce(
        (acc, stat) => {
          acc[stat.type] = stat._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  async addToCampaign(
    userId: string,
    input: { homebrewId: string; campaignId: string }
  ) {
    await authz.campaign(input.campaignId, userId).requireOwner();
    await authz.homebrew(input.homebrewId, userId).verify();
    return homebrewRepository.addToCampaign(input);
  }

  async removeFromCampaign(
    userId: string,
    input: { homebrewId: string; campaignId: string }
  ) {
    await authz.campaign(input.campaignId, userId).requireOwner();
    await homebrewRepository.removeFromCampaign(input);
    return { success: true };
  }
}

export const homebrewService = new HomebrewService();
