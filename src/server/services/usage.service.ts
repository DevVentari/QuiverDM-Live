/**
 * Usage Limit Service
 * Business logic for tier-based usage limits (Option A — dec-003, 90-day validation profile)
 */

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { ForbiddenError, NotFoundError } from '../errors';

export type UserTier = 'free' | 'pro' | 'team';

// Option A cap profile (dec-003 accepted 2026-02-24)
// Source: docs/obsidian-vault/10-Research/2026-02-23-usage-caps-benchmark.md
export const TIER_LIMITS = {
  free: {
    campaigns: 1,
    sessionUploads: 4,
    aiRecaps: 4,
    pdfUploads: 3,
    semanticSearches: 50,
    imageGenerations: 5,
  },
  pro: {
    campaigns: -1,                 // Unlimited
    sessionUploads: 30,
    aiRecaps: 30,
    pdfUploads: 40,
    semanticSearches: 1000,
    imageGenerations: 80,
  },
  team: {
    campaigns: -1,                 // Unlimited
    sessionUploads: 100,
    aiRecaps: 120,
    pdfUploads: 150,
    semanticSearches: 4000,
    imageGenerations: 300,
  },
};

export const usageService = {
  /**
   * Get or create user usage record
   */
  async getOrCreateUsage(userId: string) {
    let usage = await prisma.userUsage.findUnique({
      where: { userId },
    });

    if (!usage) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });

      if (!user) {
        throw new NotFoundError('user', userId);
      }

      const tier = (user.tier as UserTier) || 'free';
      const limits = TIER_LIMITS[tier];
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      usage = await prisma.userUsage.create({
        data: {
          userId,
          periodStart: now,
          periodEnd,
          pdfUploadLimit: limits.pdfUploads,
          campaignLimit: limits.campaigns,
          sessionUploadLimit: limits.sessionUploads,
          aiRecapLimit: limits.aiRecaps,
          semanticSearchLimit: limits.semanticSearches,
          imageGenerationLimit: limits.imageGenerations,
        },
      });
    }

    return usage;
  },

  /**
   * Get current usage status for all limit families
   */
  async getUsageStatus(userId: string) {
    const usage = await this.getOrCreateUsage(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const tier = (user?.tier as UserTier) || 'free';

    function limitStat(used: number, limit: number) {
      return {
        used,
        limit,
        remaining: limit === -1 ? -1 : limit - used,
        percentage: limit === -1 ? 0 : (used / limit) * 100,
      };
    }

    return {
      tier,
      pdfUploads: limitStat(usage.pdfUploads, usage.pdfUploadLimit),
      campaigns: limitStat(usage.campaignsOwned, TIER_LIMITS[tier].campaigns),
      sessionUploads: limitStat(usage.sessionUploads, usage.sessionUploadLimit),
      aiRecaps: limitStat(usage.aiRecaps, usage.aiRecapLimit),
      semanticSearches: limitStat(usage.semanticSearches, usage.semanticSearchLimit),
      imageGenerations: limitStat(usage.imageGenerations, usage.imageGenerationLimit),
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    };
  },

  /**
   * Check if user can create a campaign
   */
  async canCreateCampaign(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    const limit = TIER_LIMITS[(user?.tier as UserTier) || 'free'].campaigns;
    if (limit === -1) return true;
    return usage.campaignsOwned < limit;
  },

  /**
   * Check if user can upload a PDF
   */
  async canUploadPdf(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    if (usage.pdfUploadLimit === -1) return true;
    return usage.pdfUploads < usage.pdfUploadLimit;
  },

  /**
   * Check if user can upload a session recording
   */
  async canUploadSession(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    if (usage.sessionUploadLimit === -1) return true;
    return usage.sessionUploads < usage.sessionUploadLimit;
  },

  /**
   * Check if user can generate an AI recap
   */
  async canGenerateRecap(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    if (usage.aiRecapLimit === -1) return true;
    return usage.aiRecaps < usage.aiRecapLimit;
  },

  /**
   * Check if user can perform a semantic search
   */
  async canSearch(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    if (usage.semanticSearchLimit === -1) return true;
    return usage.semanticSearches < usage.semanticSearchLimit;
  },

  /**
   * Check if user can generate an image
   */
  async canGenerateImage(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    if (usage.imageGenerationLimit === -1) return true;
    return usage.imageGenerations < usage.imageGenerationLimit;
  },

  // ─── Increment methods ──────────────────────────────────────────────────────

  async incrementCampaigns(userId: string) {
    const canCreate = await this.canCreateCampaign(userId);
    if (!canCreate) {
      throw new ForbiddenError(
        'Campaign limit reached for your tier. Upgrade to Pro for unlimited campaigns.'
      );
    }
    return prisma.userUsage.update({
      where: { userId },
      data: { campaignsOwned: { increment: 1 } },
    });
  },

  async decrementCampaigns(userId: string) {
    return prisma.userUsage.update({
      where: { userId },
      data: { campaignsOwned: { decrement: 1 } },
    });
  },

  async incrementPdfUploads(userId: string) {
    const canUpload = await this.canUploadPdf(userId);
    if (!canUpload) {
      throw new ForbiddenError(
        'PDF upload limit reached for your tier. Upgrade to Pro for more uploads.'
      );
    }
    const updated = await prisma.userUsage.update({
      where: { userId },
      data: { pdfUploads: { increment: 1 } },
    });

    // Fire-and-forget threshold alert
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    if (user) {
      void this.checkAndAlertThreshold(
        userId, user.tier ?? 'free', 'pdfUploads',
        updated.pdfUploads, updated.pdfUploadLimit, updated.periodEnd
      );
    }
    return updated;
  },

  async incrementSessionUploads(userId: string) {
    const canUpload = await this.canUploadSession(userId);
    if (!canUpload) {
      throw new ForbiddenError(
        'Session upload limit reached for your tier. Upgrade to Pro for more session uploads.'
      );
    }
    const updated = await prisma.userUsage.update({
      where: { userId },
      data: { sessionUploads: { increment: 1 } },
    });

    // Fire-and-forget threshold alert
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    if (user) {
      void this.checkAndAlertThreshold(
        userId, user.tier ?? 'free', 'sessionUploads',
        updated.sessionUploads, updated.sessionUploadLimit, updated.periodEnd
      );
    }
    return updated;
  },

  async incrementAiRecaps(userId: string) {
    const canGenerate = await this.canGenerateRecap(userId);
    if (!canGenerate) {
      throw new ForbiddenError(
        'AI recap limit reached for your tier. Upgrade to Pro for more recaps.'
      );
    }
    const updated = await prisma.userUsage.update({
      where: { userId },
      data: { aiRecaps: { increment: 1 } },
    });

    // Fire-and-forget threshold alert
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    if (user) {
      void this.checkAndAlertThreshold(
        userId, user.tier ?? 'free', 'aiRecaps',
        updated.aiRecaps, updated.aiRecapLimit, updated.periodEnd
      );
    }
    return updated;
  },

  async incrementSemanticSearches(userId: string) {
    const canSearch = await this.canSearch(userId);
    if (!canSearch) {
      throw new ForbiddenError(
        'Semantic search limit reached for your tier. Upgrade to Pro for more searches.'
      );
    }
    const updated = await prisma.userUsage.update({
      where: { userId },
      data: { semanticSearches: { increment: 1 } },
    });

    // Fire-and-forget threshold alert
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    if (user) {
      void this.checkAndAlertThreshold(
        userId, user.tier ?? 'free', 'semanticSearches',
        updated.semanticSearches, updated.semanticSearchLimit, updated.periodEnd
      );
    }
    return updated;
  },

  async incrementImageGenerations(userId: string) {
    const canGenerate = await this.canGenerateImage(userId);
    if (!canGenerate) {
      throw new ForbiddenError(
        'Image generation limit reached for your tier. Upgrade to Pro for more images.'
      );
    }
    const updated = await prisma.userUsage.update({
      where: { userId },
      data: { imageGenerations: { increment: 1 } },
    });

    // Fire-and-forget threshold alert
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    if (user) {
      void this.checkAndAlertThreshold(
        userId, user.tier ?? 'free', 'imageGenerations',
        updated.imageGenerations, updated.imageGenerationLimit, updated.periodEnd
      );
    }
    return updated;
  },

  // ─── Period management ──────────────────────────────────────────────────────

  async resetUsagePeriod(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    if (!user) {
      throw new NotFoundError('user', userId);
    }

    const tier = (user.tier as UserTier) || 'free';
    const limits = TIER_LIMITS[tier];
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    return prisma.userUsage.update({
      where: { userId },
      data: {
        periodStart: now,
        periodEnd,
        pdfUploads: 0,
        campaignsOwned: 0,
        sessionUploads: 0,
        aiRecaps: 0,
        semanticSearches: 0,
        imageGenerations: 0,
        pdfUploadLimit: limits.pdfUploads,
        campaignLimit: limits.campaigns,
        sessionUploadLimit: limits.sessionUploads,
        aiRecapLimit: limits.aiRecaps,
        semanticSearchLimit: limits.semanticSearches,
        imageGenerationLimit: limits.imageGenerations,
        lastResetAt: now,
      },
    });
  },

  async updateTier(userId: string, newTier: UserTier) {
    const limits = TIER_LIMITS[newTier];

    await prisma.user.update({
      where: { id: userId },
      data: { tier: newTier },
    });

    await this.getOrCreateUsage(userId);
    return prisma.userUsage.update({
      where: { userId },
      data: {
        pdfUploadLimit: limits.pdfUploads,
        campaignLimit: limits.campaigns,
        sessionUploadLimit: limits.sessionUploads,
        aiRecapLimit: limits.aiRecaps,
        semanticSearchLimit: limits.semanticSearches,
        imageGenerationLimit: limits.imageGenerations,
      },
    });
  },

  async checkAndResetIfNeeded(userId: string) {
    const usage = await this.getOrCreateUsage(userId);
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }
    return false;
  },

  async checkAndAlertThreshold(
    userId: string,
    tier: string,
    limitFamily: string,
    used: number,
    limit: number,
    periodEnd: Date
  ): Promise<void> {
    if (limit === -1) return;
    const percentage = (used / limit) * 100;
    if (percentage < 80) return;

    // Fire-and-forget
    emailService.sendUsageAlert({ userId, tier, limitFamily, used, limit, percentage, periodEnd }).catch(() => {});
  },
};
