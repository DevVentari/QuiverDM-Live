import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    campaignMember: { findFirst: vi.fn() },
    userSettings: { upsert: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { userSettingsRouter } from '@/server/routers/user-settings'

function callerFor(userId: string) {
  return userSettingsRouter.createCaller({
    session: { user: { id: userId, email: 'dev@example.com' } },
  } as any)
}

describe('userSettings.setActiveCampaign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts UserSettings.activeCampaignId when caller is a member', async () => {
    mocks.prisma.campaignMember.findFirst.mockResolvedValue({ id: 'mem_1' })
    mocks.prisma.userSettings.upsert.mockResolvedValue({ id: 'us_1' })

    const caller = callerFor('user_1')
    const result = await caller.setActiveCampaign({ campaignId: 'camp_a' })

    expect(result).toEqual({ ok: true })
    expect(mocks.prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      create: { userId: 'user_1', activeCampaignId: 'camp_a' },
      update: { activeCampaignId: 'camp_a' },
    })
  })

  it('throws FORBIDDEN when caller is not a member of the campaign', async () => {
    mocks.prisma.campaignMember.findFirst.mockResolvedValue(null)

    const caller = callerFor('user_1')
    await expect(caller.setActiveCampaign({ campaignId: 'camp_other' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(mocks.prisma.userSettings.upsert).not.toHaveBeenCalled()
  })
})
