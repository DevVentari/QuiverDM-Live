import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = `intake-ui-${Date.now()}@recapforge-test.local`;
const PASSWORD = 'galley-and-type-1';

function makeWav(): Buffer {
  const sampleRate = 8000;
  const samples = 8000; // 1 second of silence
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    const campaigns = await prisma.campaign.findMany({ where: { userId: user.id }, select: { id: true } });
    for (const { id: campaignId } of campaigns) {
      const sessions = await prisma.gameSession.findMany({ where: { campaignId }, select: { id: true } });
      for (const { id: sessionId } of sessions) {
        fs.rmSync(path.join(__dirname, '../../../../storage/session-recordings', sessionId), { recursive: true, force: true });
      }
    }
    await prisma.campaign.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

test('deliver tracks: upload two voices, name them, gate opens (no enqueue)', async ({ page }) => {
  // Sign up + onboard quickly
  await page.goto('/auth/signup');
  await page.getByTestId('signup-name').fill('Intake Tester');
  await page.getByTestId('signup-email').fill(EMAIL);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
  await page.waitForURL(/\/onboarding/);

  const wizard = page.locator('main.rf-page');
  await wizard.getByLabel(/campaign|chronicle/i).fill('Intake Chronicle');
  await wizard.getByRole('button', { name: /continue|next/i }).click();
  await wizard.getByRole('button', { name: /skip/i }).click();
  await wizard.getByPlaceholder(/player/i).fill('Alex');
  await wizard.getByPlaceholder(/character/i).fill('Blam-Bam');
  await wizard.getByRole('button', { name: /add/i }).click();
  await wizard.getByRole('button', { name: /open the ledger|finish/i }).click();
  await page.waitForURL('/');

  // New session → composing room
  await page.getByRole('button', { name: /new session/i }).click();
  await page.waitForURL(/\/upload\?/);

  // Deliver two tracks via the file input
  const wav = makeWav();
  await page.locator('input[type="file"]').setInputFiles([
    { name: '1-alexdm.wav', mimeType: 'audio/wav', buffer: wav },
    { name: '2-jules_0.wav', mimeType: 'audio/wav', buffer: wav },
  ]);

  // Both tracks upload and appear as received
  await expect(page.getByText('1-alexdm.wav')).toBeVisible();
  await expect(page.getByText('2-jules_0.wav')).toBeVisible();
  // exact: true so the masthead's "N of N tracks received" doesn't inflate the count
  await expect(page.getByText('received', { exact: true })).toHaveCount(2, { timeout: 30_000 });

  // Gate is closed until every voice bears a name
  const setType = page.getByRole('button', { name: /set the type/i });
  await expect(setType).toBeDisabled();

  // Name both voices (party pick + DM pick)
  await page.getByRole('button', { name: 'Blam-Bam' }).first().click();
  await page.getByRole('button', { name: /the dm/i }).first().click();

  await expect(setType).toBeEnabled();
  // Deliberately NOT clicked — enqueueing is covered by unit tests + manual E2E.

  // Speaker memory persisted
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const campaign = await prisma.campaign.findFirst({ where: { userId: user!.id } });
  const mappings = await prisma.speakerMapping.findMany({ where: { campaignId: campaign!.id } });
  expect(mappings.length).toBe(2);

  // Tracks landed on disk
  const recs = await prisma.sessionRecording.findMany({
    where: { session: { campaignId: campaign!.id } },
  });
  expect(recs).toHaveLength(2);
  expect(recs.every((r) => r.mergeStatus === 'pending')).toBe(true);
  // Speaker label contract: initiate's speakerTag must match the label nameVoice
  // writes SpeakerMapping under, or the worker never resolves the DM's assignment.
  expect(recs.map((r) => r.speakerTag).sort()).toEqual(['alexdm', 'jules']);
});
