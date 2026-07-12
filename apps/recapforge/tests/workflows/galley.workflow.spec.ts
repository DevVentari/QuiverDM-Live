import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = `galley-wf-${Date.now()}@recapforge-test.local`;
const PASSWORD = 'pass-for-press-1';

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) { await prisma.campaign.deleteMany({ where: { userId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); }
  await prisma.$disconnect();
});

test('galley: read the proof, strike a table-talk mark, hear-voice affordance present', async ({ page }) => {
  await page.goto('/auth/signup');
  await page.getByTestId('signup-name').fill('Galley WF');
  await page.getByTestId('signup-email').fill(EMAIL);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel(/campaign|chronicle/i).fill('Galley Chronicle');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /skip/i }).click();
  await page.getByRole('button', { name: /open the ledger/i }).click();
  await page.waitForURL('/');

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const campaign = await prisma.campaign.findFirst({ where: { userId: user!.id } });
  const s = await prisma.gameSession.create({ data: { campaignId: campaign!.id, sessionNumber: 1, status: 'planning' } });
  const rec = await prisma.sessionRecording.create({ data: { sessionId: s.id, type: 'audio', originalUrl: `session-recordings/${s.id}/g/1-thechunk_.flac`, fileSize: 1, isMultiTrack: true, uploadGroupId: 'g', speakerTag: 'thechunk_', mergeStatus: 'complete' } });
  await prisma.trackTranscript.create({ data: { sessionId: s.id, recordingId: rec.id, uploadGroupId: 'g', speakerLabel: 'thechunk_', characterName: 'The DM', text: 'x', segments: [], status: 'done' } });
  await prisma.transcript.create({
    data: {
      sessionId: s.id, rawText: 'x', correctedText: "The DM: We begin.\n\nThe DM: pizza is here", hasSpeakers: true, source: 'multi_track',
      timestamps: [ { start: 0, end: 10, text: 'We begin.', speaker: 'The DM' }, { start: 10, end: 20, text: 'pizza is here', speaker: 'The DM' } ],
      oocReviewItems: [{ index: 1, speaker: 'The DM', text: 'pizza is here', start_formatted: '0:10', classification: 'ooc', confidence: 0.9, reason: 'table talk' }],
      cleanupStatus: 'ooc_pending_review',
    },
  });

  await prisma.gameSession.update({
    where: { id: s.id },
    data: { suggestedTitle: 'The Gate of Gravenhold', suggestedVoice: 'war-weary arrival', suggestedChapter: 8 },
  });

  await page.goto(`/proof?campaign=${campaign!.id}&session=${s.id}`);
  await expect(page.getByText('The Gate of Gravenhold')).toBeVisible();
  await expect(page.getByText('table talk')).toBeVisible();
  await page.getByRole('button', { name: /strike it/i }).click();
  await expect(page.getByText(/struck from the record/i)).toBeVisible();

  const t = await prisma.transcript.findFirst({ where: { sessionId: s.id }, select: { correctedText: true } });
  expect(t?.correctedText).not.toContain('pizza is here');
  await expect(page.getByTitle(/hear this voice/i).first()).toBeVisible();

  await page.getByRole('button', { name: /accept this title/i }).click();
  await expect(page.getByRole('button', { name: /accept this title/i })).toHaveCount(0);
  const sess = await prisma.gameSession.findUnique({ where: { id: s.id }, select: { title: true } });
  expect(sess?.title).toBe('The Gate of Gravenhold');
});
