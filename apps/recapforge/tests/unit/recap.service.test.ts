import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession } from '@/server/services/sessions.service';
import { enqueueRecap, getRecap, updateRecap, resolveTheme, renderPreview } from '@/server/services/recap.service';
import { DEFAULT_THEME, VALDRATH_THEME, type RecapContent } from '@quiverdm/shared';

vi.mock('@/lib/queue', () => ({ addForgeRecapJob: vi.fn().mockResolvedValue({ id: 'j' }) }));
import { addForgeRecapJob } from '@/lib/queue';

const prisma = new PrismaClient();
const EMAIL = `recap-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;

const content: RecapContent = {
  header: { eyebrow: 'S1', title: 'Blood at the Gate' }, statline: [], lede: 'They rode.',
  panels: { party: [{ name: 'Kael', status: 'alive' }], timeline: [], npcs: [], locations: [], adversaries: [], threads: [], whereWeLeftOff: 'The chant stopped.' },
};

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Recap Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Recap Test')).id;
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
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
});
