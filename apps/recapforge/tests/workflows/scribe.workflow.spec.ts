import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = `scribe-wf-${Date.now()}@recapforge-test.local`;
const PASSWORD = 'the-scribe-listens-1';
let sessionId = '';

test.beforeAll(async () => {
  // Seed an authenticated account + campaign + an in-progress session with one
  // voice done and one still transcribing (no merged Transcript yet).
  // (Signup happens through the UI in the test; seed the session state via prisma.)
});

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) { await prisma.campaign.deleteMany({ where: { userId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); }
  await prisma.$disconnect();
});

test('scribe at work reveals voices, then the galley shows the transcript', async ({ page }) => {
  // 1. Sign up + onboard (skip cobalt, no party)
  await page.goto('/auth/signup');
  await page.getByTestId('signup-name').fill('Scribe WF');
  await page.getByTestId('signup-email').fill(EMAIL);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel(/campaign|chronicle/i).fill('Scribe Chronicle');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /skip/i }).click();
  await page.getByRole('button', { name: /open the ledger/i }).click();
  await page.waitForURL('/');

  // 2. Seed an in-progress session directly (bypass the real worker)
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const campaign = await prisma.campaign.findFirst({ where: { userId: user!.id } });
  const s = await prisma.gameSession.create({ data: { campaignId: campaign!.id, sessionNumber: 1, title: 'The Reveal', status: 'planning' } });
  sessionId = s.id;
  const mk = (tag: string, status: string) => prisma.sessionRecording.create({
    data: { sessionId, type: 'audio', originalUrl: `k-${tag}`, fileSize: 1, isMultiTrack: true, uploadGroupId: 'g', speakerTag: tag, mergeStatus: status },
  });
  const r1 = await mk('thechunk_', 'processing');
  await mk('ven_tari', 'processing');
  await prisma.trackTranscript.create({ data: { sessionId, recordingId: r1.id, uploadGroupId: 'g', speakerLabel: 'thechunk_', characterName: 'The DM', text: 'The DM: We begin at the gate of Gravenhold.', segments: [], status: 'done' } });

  // 3. Open the scribe-at-work view
  await page.goto(`/proof?campaign=${campaign!.id}&session=${sessionId}`);
  await expect(page.getByText(/the scribe at work/i)).toBeVisible();
  await expect(page.getByText('The DM', { exact: true })).toBeVisible();
  await expect(page.getByText(/We begin at the gate/i)).toBeVisible();
  await expect(page.getByText(/the scribe is listening/i)).toBeVisible(); // the second voice

  // 4. Complete it: mark recordings complete + write the merged Transcript
  await prisma.sessionRecording.updateMany({ where: { sessionId }, data: { mergeStatus: 'complete' } });
  await prisma.transcript.create({
    data: {
      sessionId, rawText: 'x', correctedText: 'x', hasSpeakers: true, source: 'multi_track',
      timestamps: [
        { start: 0, end: 10, text: 'We begin at the gate of Gravenhold.', speaker: 'The DM' },
        { start: 10, end: 20, text: 'I draw my blade.', speaker: 'The Beast of Snarlswood' },
      ],
      cleanupStatus: 'complete',
    },
  });

  // 5. Poll refetch (every 4s) flips it to the galley
  await expect(page.getByText('The Reveal', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('The Beast of Snarlswood')).toBeVisible();
  await expect(page.getByText(/I draw my blade/i)).toBeVisible();
});
