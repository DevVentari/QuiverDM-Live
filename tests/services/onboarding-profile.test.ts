import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userSettings: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { onboardingService } from '@/server/services/onboarding.service';

describe('onboardingService.completeProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.update.mockResolvedValue({ id: 'user-1', onboardingStep: 'first_campaign', onboardingCompleted: false });
    mocks.prisma.userSettings.upsert.mockResolvedValue({});
  });

  it('writes dmExperience to UserSettings when provided', async () => {
    await onboardingService.completeProfile('user-1', {
      displayName: 'Vic',
      dmExperience: 'veteran',
    });

    expect(mocks.prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: { dmExperience: 'veteran' },
        create: expect.objectContaining({ dmExperience: 'veteran', userId: 'user-1' }),
      })
    );
  });

  it('does not call userSettings.upsert when dmExperience is absent', async () => {
    await onboardingService.completeProfile('user-1', { displayName: 'Vic' });
    expect(mocks.prisma.userSettings.upsert).not.toHaveBeenCalled();
  });
});
