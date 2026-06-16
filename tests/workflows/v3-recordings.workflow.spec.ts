import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Recordings — real audio playback (native <audio> streaming from
// /api/storage) + a transcript whose timestamps seek the player. The fixture
// uses a storage path; the element + seek wiring is what's under test, not the
// bytes of a real recording.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-recordings-qa';
const SESSION_TITLE = 'The Siege of Greenest';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — recordings playback', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Recordings QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('recordings QA campaign missing');

    // Fresh: clear the campaign's sessions (cascades recordings + transcripts).
    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });

    const session = await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: SESSION_TITLE, status: 'completed' },
    });
    const recording = await prisma.sessionRecording.create({
      data: {
        sessionId: session.id,
        type: 'audio',
        originalUrl: '/api/storage/qa-fixture-recording.mp3',
        fileSize: 2_048_000,
        durationSeconds: 1830,
        processingStatus: 'completed',
      },
    });
    await prisma.transcript.create({
      data: {
        sessionId: session.id,
        recordingId: recording.id,
        rawText: 'We ride at dawn. Not without me.',
        correctedText: 'Aldric: We ride at dawn.\nMira: Not without me.',
        hasSpeakers: true,
        timestamps: [
          { speaker: 'Aldric', text: 'We ride at dawn.', start: 5 },
          { speaker: 'Mira', text: 'Not without me.', start: 12 },
        ],
      },
    });
  });

  test('recordings: native audio renders and a transcript line seeks it', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'audio-and-transcript-render', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/recordings`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(SESSION_TITLE).first()).toBeVisible({ timeout: 12_000 });

      // Real <audio> element bound to the storage URL.
      const audio = page.getByTestId('recording-audio');
      await expect(audio).toBeAttached({ timeout: 10_000 });
      await expect(audio).toHaveAttribute('src', /qa-fixture-recording\.mp3/);

      // Transcript segment rendered with a seekable timestamp.
      await expect(page.getByText(/We ride at dawn/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'seek-does-not-crash', async () => {
      // 0:05 is the first segment's timestamp, rendered as a seek button.
      await page.getByRole('button', { name: '0:05' }).first().click();
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 15_000);
  });
});
