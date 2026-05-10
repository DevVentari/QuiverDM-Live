import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    userSettings: { findUnique: vi.fn() },
    campaignMember: { findFirst: vi.fn() },
  },
  campaignRepository: {
    getUserMemberships: vi.fn(),
    getUserCharactersInCampaigns: vi.fn(),
    getLastSessionDates: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/repositories/campaign.repository', () => ({
  campaignRepository: mocks.campaignRepository,
}))

import { campaignService } from '@/server/services/campaign.service'

const USER_ID = 'user_1'
const CAMPAIGN_A = { id: 'camp_a', name: 'A', slug: 'a' }
const CAMPAIGN_B = { id: 'camp_b', name: 'B', slug: 'b' }

function membership(campaign: { id: string; name: string; slug: string }, role = 'OWNER') {
  return {
    campaignId: campaign.id,
    role,
    canViewNPCSecrets: true,
    canEditNPCs: true,
    canManageSessions: true,
    canInviteMembers: true,
    campaign: {
      ...campaign,
      bannerUrl: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-05-01'),
      _count: { gameSessions: 3, members: 2 },
      gameSessions: [],
    },
  }
}

describe('campaignService.getActiveCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.campaignRepository.getUserCharactersInCampaigns.mockResolvedValue([])
    mocks.campaignRepository.getLastSessionDates.mockResolvedValue([])
  })

  it('returns the campaign matching activeCampaignId when membership is valid', async () => {
    mocks.prisma.userSettings.findUnique.mockResolvedValue({ activeCampaignId: 'camp_b' })
    mocks.campaignRepository.getUserMemberships.mockResolvedValue([
      membership(CAMPAIGN_A),
      membership(CAMPAIGN_B),
    ])

    const result = await campaignService.getActiveCampaign(USER_ID)

    expect(result?.id).toBe('camp_b')
  })

  it('falls back to auto-derive when activeCampaignId is null', async () => {
    mocks.prisma.userSettings.findUnique.mockResolvedValue({ activeCampaignId: null })
    mocks.campaignRepository.getUserMemberships.mockResolvedValue([
      membership({ ...CAMPAIGN_A, name: 'A' }),
      membership({ ...CAMPAIGN_B, name: 'B' }),
    ])
    mocks.campaignRepository.getLastSessionDates.mockResolvedValue([
      { campaignId: 'camp_b', date: new Date('2026-05-09') },
    ])

    const result = await campaignService.getActiveCampaign(USER_ID)

    expect(result?.id).toBe('camp_b')
  })

  it('falls back to auto-derive when UserSettings row does not exist', async () => {
    mocks.prisma.userSettings.findUnique.mockResolvedValue(null)
    mocks.campaignRepository.getUserMemberships.mockResolvedValue([membership(CAMPAIGN_A)])

    const result = await campaignService.getActiveCampaign(USER_ID)

    expect(result?.id).toBe('camp_a')
  })

  it('falls back when activeCampaignId references a campaign user is no longer a member of', async () => {
    mocks.prisma.userSettings.findUnique.mockResolvedValue({ activeCampaignId: 'camp_gone' })
    mocks.campaignRepository.getUserMemberships.mockResolvedValue([membership(CAMPAIGN_A)])

    const result = await campaignService.getActiveCampaign(USER_ID)

    expect(result?.id).toBe('camp_a')
  })

  it('returns null when user has no campaigns', async () => {
    mocks.prisma.userSettings.findUnique.mockResolvedValue({ activeCampaignId: null })
    mocks.campaignRepository.getUserMemberships.mockResolvedValue([])

    const result = await campaignService.getActiveCampaign(USER_ID)

    expect(result).toBeNull()
  })
})
