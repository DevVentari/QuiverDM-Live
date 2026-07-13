// This workflow exercises the P5 publish loop WITHOUT real ssh: it seeds a
// `ready` ForgeRecap on a campaign whose publishConfig is set, mocks
// @/lib/ssh-publish and stubs renderDownload (transport-focused — the render
// path itself is covered by the P4 workflow spec), then calls publishRecap
// directly (real Prisma, live homelab DB) and asserts the full publish
// contract: mocked ssh invoked with the rendered html + session number, the
// Valdrath URL returned, and ForgeRecap.publishedAt/publishedUrl recorded.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession } from '@/server/services/sessions.service';

const sshMock = vi.fn().mockResolvedValue('published session-1');
vi.mock('@/lib/ssh-publish', () => ({ sshPublish: (...a: unknown[]) => sshMock(...a) }));
vi.mock('@/server/services/recap.service', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, renderDownload: vi.fn().mockResolvedValue({ filename: 'session-1.html', html: '<!DOCTYPE html><html>recap</html>' }) };
});
import { publishRecap } from '@/server/services/publish.service';

const prisma = new PrismaClient();
const EMAIL = `wf-pub-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;

beforeAll(async () => {
  process.env.RECAP_PUBLISH_SSH_KEY = 'test-key';
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'WFPub' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Valdrath Pub WF')).id;
  await prisma.campaign.update({ where: { id: campaignId }, data: { publishConfig: { host: '192.168.1.15', user: 'valdrath-recv', urlBase: 'https://valdrath.quiverdm.com' } } });
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
  await prisma.forgeRecap.create({ data: { sessionId, status: 'ready' } });
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('forge-recap publish workflow: ready → publish → live URL recorded', () => {
  it('publishes over (mocked) ssh and records publishedAt + the Valdrath URL', async () => {
    const res = await publishRecap(prisma, userId, { campaignId, sessionId });
    expect(res.url).toBe('https://valdrath.quiverdm.com/session-1');
    expect(sshMock).toHaveBeenCalledWith(expect.objectContaining({ sessionNumber: expect.any(Number), html: expect.stringContaining('<!DOCTYPE html>') }));
    const row = await prisma.forgeRecap.findUnique({ where: { sessionId } });
    expect(row?.publishedUrl).toBe('https://valdrath.quiverdm.com/session-1');
    expect(row?.publishedAt).toBeInstanceOf(Date);
  });
});
