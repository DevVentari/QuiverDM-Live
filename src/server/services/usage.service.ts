/**
 * Usage Limit Service
 * Business logic for tier-based usage limits
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, RateLimitedError } from '../errors';

export type UserTier = 'free' | 'pro' | 'team';

// Tier limits configuration
export const TIER_LIMITS = {
  free: {
    campaigns: 1,
    transcriptionSeconds: 1800, // 30 minutes
    pdfUploads: 5,
  },
  pro: {
    campaigns: -1, // Unlimited
    transcriptionSeconds: 36000, // 10 hours
    pdfUploads: 50,
  },
  team: {
    campaigns: -1, // Unlimited
    transcriptionSeconds: 108000, // 30 hours
    pdfUploads: 200,
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
          transcriptionLimit: limits.transcriptionSeconds,
          pdfUploadLimit: limits.pdfUploads,
          campaignLimit: limits.campaigns,
        },
      });
    }

    return usage;
  },

  /**
   * Get current usage status
   */
  async getUsageStatus(userId: string) {
    const usage = await this.getOrCreateUsage(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const tier = (user?.tier as UserTier) || 'free';

    return {
      tier,
      transcription: {
        used: usage.transcriptionSeconds,
        limit: usage.transcriptionLimit,
        remaining:
          usage.transcriptionLimit === -1
            ? -1
            : usage.transcriptionLimit - usage.transcriptionSeconds,
        percentage:
          usage.transcriptionLimit === -1
            ? 0
            : (usage.transcriptionSeconds / usage.transcriptionLimit) * 100,
      },
      pdfUploads: {
        used: usage.pdfUploads,
        limit: usage.pdfUploadLimit,
        remaining:
          usage.pdfUploadLimit === -1
            ? -1
            : usage.pdfUploadLimit - usage.pdfUploads,
        percentage:
          usage.pdfUploadLimit === -1
            ? 0
            : (usage.pdfUploads / usage.pdfUploadLimit) * 100,
      },
      campaigns: {
        used: usage.campaignsOwned,
        limit: usage.campaignLimit,
        remaining:
          usage.campaignLimit === -1
            ? -1
            : usage.campaignLimit - usage.campaignsOwned,
        percentage:
          usage.campaignLimit === -1
            ? 0
            : (usage.campaignsOwned / usage.campaignLimit) * 100,
      },
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    };
  },

  /**
   * Check if user can create a campaign
   */
  async canCreateCampaign(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);

    // Check if needs reset
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true; // After reset, can create
    }

    if (usage.campaignLimit === -1) return true; // Unlimited
    return usage.campaignsOwned < usage.campaignLimit;
  },

  /**
   * Check if user can upload a PDF
   */
  async canUploadPdf(userId: string): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);

    // Check if needs reset
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }

    if (usage.pdfUploadLimit === -1) return true; // Unlimited
    return usage.pdfUploads < usage.pdfUploadLimit;
  },

  /**
   * Check if user can transcribe (has minutes remaining)
   */
  async canTranscribe(userId: string, durationSeconds: number): Promise<boolean> {
    const usage = await this.getOrCreateUsage(userId);

    // Check if needs reset
    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }

    if (usage.transcriptionLimit === -1) return true; // Unlimited
    return usage.transcriptionSeconds + durationSeconds <= usage.transcriptionLimit;
  },

  /**
   * Increment campaign count
   */
  async incrementCampaigns(userId: string) {
    const canCreate = await this.canCreateCampaign(userId);
    if (!canCreate) {
      throw new RateLimitedError(
        'Campaign limit reached for your tier. Upgrade to Pro for unlimited campaigns.'
      );
    }

    return prisma.userUsage.update({
      where: { userId },
      data: { campaignsOwned: { increment: 1 } },
    });
  },

  /**
   * Decrement campaign count (when campaign is deleted)
   */
  async decrementCampaigns(userId: string) {
    return prisma.userUsage.update({
      where: { userId },
      data: { campaignsOwned: { decrement: 1 } },
    });
  },

  /**
   * Increment PDF upload count
   */
  async incrementPdfUploads(userId: string) {
    const canUpload = await this.canUploadPdf(userId);
    if (!canUpload) {
      throw new RateLimitedError(
        'PDF upload limit reached for your tier. Upgrade to Pro for more uploads.'
      );
    }

    return prisma.userUsage.update({
      where: { userId },
      data: { pdfUploads: { increment: 1 } },
    });
  },

  /**
   * Increment transcription seconds
   */
  async incrementTranscription(userId: string, durationSeconds: number) {
    const canTranscribe = await this.canTranscribe(userId, durationSeconds);
    if (!canTranscribe) {
      throw new RateLimitedError(
        'Transcription limit reached for your tier. Upgrade to Pro for more minutes.'
      );
    }

    return prisma.userUsage.update({
      where: { userId },
      data: { transcriptionSeconds: { increment: Math.ceil(durationSeconds) } },
    });
  },

  /**
   * Reset usage period (monthly reset)
   */
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
        transcriptionSeconds: 0,
        pdfUploads: 0,
        transcriptionLimit: limits.transcriptionSeconds,
        pdfUploadLimit: limits.pdfUploads,
        campaignLimit: limits.campaigns,
        lastResetAt: now,
      },
    });
  },

  /**
   * Update tier and adjust limits
   */
  async updateTier(userId: string, newTier: UserTier) {
    const limits = TIER_LIMITS[newTier];

    // Update user tier
    await prisma.user.update({
      where: { id: userId },
      data: { tier: newTier },
    });

    // Update usage limits (but don't reset current usage)
    const usage = await this.getOrCreateUsage(userId);
    return prisma.userUsage.update({
      where: { userId },
      data: {
        transcriptionLimit: limits.transcriptionSeconds,
        pdfUploadLimit: limits.pdfUploads,
        campaignLimit: limits.campaigns,
      },
    });
  },

  /**
   * Check if user needs to reset their usage period
   */
  async checkAndResetIfNeeded(userId: string) {
    const usage = await this.getOrCreateUsage(userId);

    if (new Date() > usage.periodEnd) {
      await this.resetUsagePeriod(userId);
      return true;
    }

    return false;
  },
};
