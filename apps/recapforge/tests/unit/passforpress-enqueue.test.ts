import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession, passForPress } from '@/server/services/sessions.service';

vi.mock('@/lib/queue', () => ({ addForgeRecapJob: vi.fn().mockResolvedValue({ id: 'j' }), addMultiTrackJob: vi.fn() }));
import { addForgeRecapJob } from '@/lib/queue';

const prisma = new PrismaClient();
const EMAIL = `pfp-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'PFP' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'PFP')).id;
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('passForPress', () => {
  it('marks the session completed and enqueues the recap', async () => {
    await passForPress(prisma, userId, { campaignId, sessionId });
    expect(addForgeRecapJob).toHaveBeenCalledWith({ campaignId, sessionId, userId });
    const s = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { status: true } });
    expect(s?.status).toBe('completed');
    const r = await prisma.forgeRecap.findUnique({ where: { sessionId }, select: { status: true } });
    expect(r?.status).toBe('generating');
  });
});
