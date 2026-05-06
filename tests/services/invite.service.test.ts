import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inviteRepository: {
    findByCode: vi.fn(),
    markAsUsed: vi.fn(),
  },
}));

vi.mock('@/server/repositories/invite.repository', () => ({
  inviteRepository: mocks.inviteRepository,
}));

import { inviteService } from '@/server/services/invite.service';

describe('inviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes invite codes before lookup', async () => {
    mocks.inviteRepository.findByCode.mockResolvedValue({
      id: 'invite-1',
      code: 'QDMABCD-1234',
      usedBy: null,
      usedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      expiresAt: null,
    });

    await inviteService.validateCode(' qdmabcd-1234 ');

    expect(mocks.inviteRepository.findByCode).toHaveBeenCalledWith('QDMABCD-1234');
  });

  it('reuses the normalized code when redeeming', async () => {
    mocks.inviteRepository.findByCode.mockResolvedValue({
      id: 'invite-1',
      code: 'QDMWXYZ-9876',
      usedBy: null,
      usedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      expiresAt: null,
    });
    mocks.inviteRepository.markAsUsed.mockResolvedValue({});

    await inviteService.redeemCode(' qdmwxyz-9876 ', 'user-1');

    expect(mocks.inviteRepository.markAsUsed).toHaveBeenCalledWith('QDMWXYZ-9876', 'user-1');
  });
});
