import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession } from '@/server/services/sessions.service';
import { enqueueRecap, getRecap, updateRecap, resolveTheme, renderPreview, inlineImage } from '@/server/services/recap.service';
import { DEFAULT_THEME, VALDRATH_THEME, type RecapContent } from '@quiverdm/shared';

vi.mock('@/lib/queue', () => ({ addForgeRecapJob: vi.fn().mockResolvedValue({ id: 'j' }) }));
import { addForgeRecapJob } from '@/lib/queue';

const prisma = new PrismaClient();
const EMAIL = `recap-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;
let campaignBId: string, foreignSessionId: string;

const content: RecapContent = {
  header: { eyebrow: 'S1', title: 'Blood at the Gate' }, statline: [], lede: 'They rode.',
  panels: { party: [{ name: 'Kael', status: 'alive' }], timeline: [], npcs: [], locations: [], adversaries: [], threads: [], whereWeLeftOff: 'The chant stopped.' },
};

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Recap Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Recap Test')).id;
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
  campaignBId = (await createForgeCampaign(prisma, userId, 'Campaign B')).id;
  foreignSessionId = (await createSession(prisma, userId, { campaignId: campaignBId })).id;
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.forgeRecap.deleteMany({ where: { sessionId: foreignSessionId } });
  await prisma.campaign.deleteMany({ where: { id: { in: [campaignId, campaignBId] } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('resolveTheme', () => {
  it('returns default for null and the stored theme otherwise', () => {
    expect(resolveTheme(null).palette.blood).toBe(DEFAULT_THEME.palette.blood);
    expect(resolveTheme(VALDRATH_THEME).palette.blood).toBe('#8a1c1c');
  });
});

describe('recap.service ownership + round-trip', () => {
  it('enqueue creates a generating row and queues the job', async () => {
    await enqueueRecap(prisma, userId, { campaignId, sessionId });
    expect(addForgeRecapJob).toHaveBeenCalledWith({ campaignId, sessionId, userId });
    const row = await getRecap(prisma, userId, { campaignId, sessionId });
    expect(row?.status).toBe('generating');
  });

  it('update stores edited content and getRecap reads it back', async () => {
    await updateRecap(prisma, userId, { campaignId, sessionId, content });
    const row = await getRecap(prisma, userId, { campaignId, sessionId });
    expect(row?.content?.header.title).toBe('Blood at the Gate');
  });

  it('renderPreview returns HTML with the edited title', async () => {
    const html = await renderPreview(prisma, userId, { campaignId, sessionId });
    expect(html).toContain('Blood at the Gate');
  });

  it('a stranger is FORBIDDEN', async () => {
    const s = await prisma.user.create({ data: { email: `str-${Date.now()}@t.local`, name: 'S' } });
    await expect(getRecap(prisma, s.id, { campaignId, sessionId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(updateRecap(prisma, s.id, { campaignId, sessionId, content })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await prisma.user.delete({ where: { id: s.id } });
  });

  it('owner of campaign A cannot enqueue a session from campaign B (cross-campaign IDOR)', async () => {
    // Clear mock to verify it's not called for the foreign session
    vi.clearAllMocks();

    // Campaign owner tries to enqueue using their owned campaign A with a session from campaign B
    await expect(
      enqueueRecap(prisma, userId, { campaignId, sessionId: foreignSessionId })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Verify the queue job was NOT enqueued
    expect(addForgeRecapJob).not.toHaveBeenCalled();
  });

  it('marks the row failed (not stuck generating) when the queue add throws', async () => {
    vi.mocked(addForgeRecapJob).mockRejectedValueOnce(new Error('redis unreachable'));

    await expect(enqueueRecap(prisma, userId, { campaignId, sessionId })).rejects.toThrow('redis unreachable');

    const row = await getRecap(prisma, userId, { campaignId, sessionId });
    expect(row?.status).toBe('failed');
    expect(row?.error).toBe('Could not queue recap generation.');
  });
});

describe('inlineImage SSRF guard', () => {
  const base: RecapContent = {
    header: { eyebrow: 'S1', title: 'T' }, statline: [], lede: 'x',
    panels: { party: [], timeline: [], npcs: [], locations: [], adversaries: [], threads: [], whereWeLeftOff: 'x' },
  };
  const withImageUrl = (url: string): RecapContent => ({ ...base, header: { ...base.header, image: { url } } });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['localhost', 'http://localhost:9999/x.png'],
    ['loopback IP', 'http://127.0.0.1/x.png'],
    ['private LAN', 'http://192.168.1.21/x.png'],
    ['private 10/8', 'http://10.0.0.5/x.png'],
    ['file scheme', 'file:///etc/passwd'],
  ])('%s is hotlinked unchanged and fetch is never called', async (_label, url) => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const result = await inlineImage(withImageUrl(url));
    expect(result.header.image?.url).toBe(url);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a public https host is fetched and inlined as a data URI', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': '4' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as unknown as Response);

    const result = await inlineImage(withImageUrl('https://example.com/hero.png'));
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/hero.png', expect.objectContaining({ signal: expect.anything() }));
    expect(result.header.image?.url.startsWith('data:image/png;base64,')).toBe(true);
  });
});
