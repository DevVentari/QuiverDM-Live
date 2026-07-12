// This workflow exercises the P4 loop WITHOUT a browser or the live worker: it
// seeds a reviewed transcript on a real session (real Prisma, live homelab DB),
// runs generateSessionRecap directly (mocking chatWithAI), edits a field via
// updateRecap, then renders the download. Proves the full data path:
// pass-for-press → ready → edit → download.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createForgeCampaign } from '@/server/services/campaign.service';
import { createSession } from '@/server/services/sessions.service';
import { updateRecap, renderDownload } from '@/server/services/recap.service';
import { VALDRATH_THEME, type RecapContent } from '@quiverdm/shared';

const chat = vi.fn();
vi.mock('@main/lib/ai/chat', () => ({ chatWithAI: (...a: unknown[]) => chat(...a) }));
import { generateSessionRecap } from '@main/lib/recapforge/generate-recap';

const prisma = new PrismaClient();
const EMAIL = `wf-recap-${Date.now()}@recapforge-test.local`;
let userId: string, campaignId: string, sessionId: string;

const modelReply = JSON.stringify({
  header: { eyebrow: 'Session One', title: 'Blood at the Gate' },
  statline: [{ label: 'Run-time', value: '3h' }], lede: 'They rode to Gravenhold.',
  panels: {
    party: [{ name: 'Kael', role: 'Fighter', status: 'alive' }],
    timeline: [{ title: 'Arrival', body: 'They reached the gate.', marker: 'reveal' }],
    npcs: [{ name: 'The Commander', disposition: 'neutral' }],
    locations: [{ name: 'Gravenhold' }], adversaries: [{ name: 'Cultists' }],
    threads: [{ title: 'The chant', marker: 'flag' }], whereWeLeftOff: 'The chant stopped.',
  },
});

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'WF' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Valdrath WF')).id;
  await prisma.campaign.update({ where: { id: campaignId }, data: { theme: VALDRATH_THEME as object } });
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
  // Seed a reviewed transcript on the session.
  await prisma.transcript.create({
    data: {
      sessionId, cleanupStatus: 'complete', rawText: 'We ride to Gravenhold. roll initiative',
      timestamps: [
        { start: 0, end: 1, text: 'We ride to Gravenhold.', speaker: 'Kael' },
        { start: 1, end: 2, text: 'roll initiative', speaker: 'DM' },
      ] as object,
      oocReviewItems: [{ index: 1, text: 'roll initiative', reason: 'table talk', classification: 'ooc', verdict: 'strike' }] as object,
    },
  });
});
afterAll(async () => {
  await prisma.forgeRecap.deleteMany({ where: { sessionId } });
  await prisma.transcript.deleteMany({ where: { sessionId } });
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('forge-recap workflow: pass-for-press → ready → edit → download', () => {
  it('generates a ready recap, excludes struck OOC, applies the Valdrath theme, and downloads edited HTML', async () => {
    chat.mockResolvedValueOnce(modelReply);
    await generateSessionRecap(prisma, { campaignId, sessionId });

    const row = await prisma.forgeRecap.findUnique({ where: { sessionId } });
    expect(row?.status).toBe('ready');
    const content = row!.content as unknown as RecapContent;
    expect(content.header.title).toBe('Blood at the Gate');
    // struck "roll initiative" never reached the model prompt
    expect(chat.mock.calls[0][0].at(-1).content).not.toContain('roll initiative');

    // Edit a field
    const edited: RecapContent = { ...content, header: { ...content.header, subtitle: 'Arrival in Gravenhold' } };
    await updateRecap(prisma, userId, { campaignId, sessionId, content: edited });

    // Download reflects the edit + the Valdrath palette + the relabelled panel
    const { filename, html } = await renderDownload(prisma, userId, { campaignId, sessionId });
    expect(filename).toBe('session-1.html');
    expect(html).toContain('Arrival in Gravenhold');
    expect(html).toContain('--blood:#8a1c1c');
    expect(html).toContain('Demons Below');
    expect(html).toMatch(/^<!DOCTYPE html>/i);
  });
});
