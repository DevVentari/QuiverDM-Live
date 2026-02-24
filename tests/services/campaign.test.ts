import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { NotFoundError, ValidationError } from '@/server/errors';

const mocks = vi.hoisted(() => ({
  campaignRepository: {
    findByUser: vi.fn(),
    findWithDetails: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
    slugExists: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  usageService: {
    incrementCampaigns: vi.fn(),
    decrementCampaigns: vi.fn(),
  },
  authz: {
    campaign: vi.fn(),
  },
}));

vi.mock('@/server/repositories/campaign.repository', () => ({
  campaignRepository: mocks.campaignRepository,
}));

vi.mock('@/server/services/usage.service', () => ({
  usageService: mocks.usageService,
}));

vi.mock('@/server/services/authorization.service', () => ({
  authz: mocks.authz,
}));

import { campaignService } from '@/server/services/campaign.service';

describe('campaignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usageService.incrementCampaigns.mockResolvedValue(undefined);
    mocks.usageService.decrementCampaigns.mockResolvedValue(undefined);
  });

  it('generates a URL-safe slug from campaign name', async () => {
    mocks.campaignRepository.slugExists.mockResolvedValue(false);
    mocks.campaignRepository.create.mockImplementation(async (data: any) => ({ id: 'c1', ...data }));

    const result = await campaignService.create('user-1', { name: 'My Campaign!' });

    expect(result.slug).toBe('my-campaign');
  });

  it('appends a suffix for slug uniqueness', async () => {
    mocks.campaignRepository.slugExists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mocks.campaignRepository.create.mockImplementation(async (data: any) => ({ id: 'c1', ...data }));

    const result = await campaignService.create('user-1', { name: 'My Campaign!' });

    expect(result.slug).toBe('my-campaign-1');
  });

  it('handles special chars, emoji-only, and very long names with valid slugs', async () => {
    mocks.campaignRepository.slugExists.mockResolvedValue(false);
    mocks.campaignRepository.create.mockImplementation(async (data: any) => ({ id: 'c1', ...data }));

    const special = await campaignService.create('user-1', { name: '!!!@@@###' });
    const emoji = await campaignService.create('user-1', { name: '\u{1F600}\u{1F525}\u{1F3B2}' });
    const long = await campaignService.create('user-1', { name: 'a'.repeat(220) });

    expect(special.slug).toMatch(/^[a-z0-9-]+$/);
    expect(emoji.slug).toMatch(/^[a-z0-9-]+$/);
    expect(long.slug.length).toBeLessThanOrEqual(50);
  });

  it('throws ValidationError for empty name', async () => {
    await expect(campaignService.create('user-1', { name: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('assigns owner userId on create', async () => {
    mocks.campaignRepository.slugExists.mockResolvedValue(false);
    mocks.campaignRepository.create.mockImplementation(async (data: any) => ({ id: 'c1', ...data }));

    await campaignService.create('owner-123', { name: 'Alpha' });

    expect(mocks.campaignRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-123' })
    );
  });

  it('throws NotFoundError when slug does not exist', async () => {
    mocks.campaignRepository.findBySlug.mockResolvedValue(null);

    await expect(campaignService.getBySlug('missing-slug', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws forbidden when non-member fetches private campaign', async () => {
    mocks.authz.campaign.mockReturnValue({
      verify: vi.fn().mockRejectedValue(new TRPCError({ code: 'FORBIDDEN', message: 'No access' })),
    });

    await expect(campaignService.getById('campaign-1', 'outsider')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

