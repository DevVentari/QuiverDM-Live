/**
 * Onboarding Service
 * Business logic for new user onboarding flow
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '../errors';

export type OnboardingStep = 'welcome' | 'profile' | 'first_campaign' | 'complete';

export const onboardingService = {
  /**
   * Get user's onboarding status
   */
  async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        onboardingStep: true,
        inviteCodeUsed: true,
        displayName: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('user', userId);
    }

    return {
      completed: user.onboardingCompleted,
      currentStep: (user.onboardingStep as OnboardingStep | null) || 'welcome',
      inviteCode: user.inviteCodeUsed,
      hasProfile: !!(user.displayName || user.bio),
      createdAt: user.createdAt,
    };
  },

  /**
   * Update onboarding step
   */
  async updateStep(userId: string, step: OnboardingStep) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: step,
        onboardingCompleted: step === 'complete',
      },
    });

    return {
      completed: user.onboardingCompleted,
      currentStep: step,
    };
  },

  /**
   * Complete welcome step
   */
  async completeWelcome(userId: string) {
    return this.updateStep(userId, 'profile');
  },

  /**
   * Complete profile step
   */
  async completeProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
    }
  ) {
    // Update profile
    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: data.displayName,
        bio: data.bio,
      },
    });

    // Move to next step
    return this.updateStep(userId, 'first_campaign');
  },

  /**
   * Complete first campaign step
   * This is called when user creates or joins their first campaign
   */
  async completeFirstCampaign(userId: string) {
    return this.updateStep(userId, 'complete');
  },

  /**
   * Skip onboarding (mark as complete)
   */
  async skip(userId: string) {
    return this.updateStep(userId, 'complete');
  },

  /**
   * Reset onboarding (for testing)
   */
  async reset(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: false,
        onboardingStep: 'welcome',
      },
    });

    return {
      completed: false,
      currentStep: 'welcome' as OnboardingStep,
    };
  },

  /**
   * Record which invite code was used during signup
   */
  async recordInviteCode(userId: string, inviteCode: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { inviteCodeUsed: inviteCode },
    });
  },

  /**
   * Check if user needs onboarding
   */
  async needsOnboarding(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });

    return !user?.onboardingCompleted;
  },
};
