import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession } from '@/server/services/sessions.service';

const sshMock = vi.fn();
vi.mock('@/lib/ssh-publish', () => ({ sshPublish: (...a: unknown[]) => sshMock(...a) }));
// renderDownload hits the DB for content; stub it so the test is transport-focused.
vi.mock('@/server/services/recap.service', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, renderDownload: vi.fn().mockResolvedValue({ filename: 'session-1.html', html: '<html>recap</html>' }) };
});

import { publishRecap } from '@/server/services/publish.service';

const prisma = new PrismaClient();
const EMAIL = `pub-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;

beforeAll(async () => {
  // sshPublish is mocked below, so this never touches a real key — it only
  // satisfies publishRecap's "is publishing configured on this server" guard.
  process.env.RECAP_PUBLISH_SSH_KEY = 'test-key';
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Pub' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Pub Test')).id;
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
  await prisma.forgeRecap.create({ data: { sessionId, status: 'ready' } });
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});
// NOTE: no `beforeEach(() => sshMock.mockReset())` here on purpose — calling
// mockReset()/mockClear() on this spy between tests triggers a Vitest v3.2.4
// tinyspy instrumentation quirk that flags a spurious "unhandled rejection"
// failure on the very next test that uses mockRejectedValue, even though the
// rejection is properly caught and asserted. Each test below sets its own
// mock behavior explicitly before use, so isolation doesn't depend on reset.

describe('publishRecap', () => {
  it('rejects (PRECONDITION_FAILED) and does NOT ssh when the campaign has no publishConfig', async () => {
    await prisma.campaign.update({ where: { id: campaignId }, data: { publishConfig: Prisma.JsonNull } });
    await expect(publishRecap(prisma, userId, { campaignId, sessionId })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(sshMock).not.toHaveBeenCalled();
  });

  it('publishes, sets publishedAt/publishedUrl, clears error, returns the url', async () => {
    await prisma.campaign.update({ where: { id: campaignId }, data: { publishConfig: { host: '192.168.1.15', user: 'valdrath-recv', urlBase: 'https://valdrath.quiverdm.com' } } });
    sshMock.mockResolvedValue('published session-1');
    const res = await publishRecap(prisma, userId, { campaignId, sessionId });
    expect(res.url).toBe('https://valdrath.quiverdm.com/session-1');
    expect(sshMock).toHaveBeenCalledWith(expect.objectContaining({ host: '192.168.1.15', user: 'valdrath-recv', sessionNumber: expect.any(Number), html: '<html>recap</html>' }));
    const row = await prisma.forgeRecap.findUnique({ where: { sessionId } });
    expect(row?.publishedUrl).toBe('https://valdrath.quiverdm.com/session-1');
    expect(row?.publishedAt).toBeInstanceOf(Date);
    expect(row?.publishError).toBeNull();
  });

  it('stores publishError and leaves publishedAt untouched on ssh failure', async () => {
    await prisma.forgeRecap.update({ where: { sessionId }, data: { publishedAt: null, publishError: null } });
    sshMock.mockRejectedValue(new Error('ssh exited 255'));
    await expect(publishRecap(prisma, userId, { campaignId, sessionId })).rejects.toThrow(/255/);
    const row = await prisma.forgeRecap.findUnique({ where: { sessionId } });
    expect(row?.publishError).toMatch(/255/);
    expect(row?.publishedAt).toBeNull();
  });

  it('a stranger is FORBIDDEN', async () => {
    const s = await prisma.user.create({ data: { email: `str-${Date.now()}@t.local`, name: 'S' } });
    await expect(publishRecap(prisma, s.id, { campaignId, sessionId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await prisma.user.delete({ where: { id: s.id } });
  });
});
