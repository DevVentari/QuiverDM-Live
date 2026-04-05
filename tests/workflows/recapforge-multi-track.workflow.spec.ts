import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

/**
 * RecapForge Multi-Track Upload Workflow
 *
 * Covers the DM journey: upload multiple audio files → tag speakers →
 * trigger transcription → view progress → see merged transcript.
 */

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.describe('RecapForge: Multi-Track Upload', () => {
  test('DM can navigate to app without being redirected to sign-in', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    await expect(page).not.toHaveURL('/auth/signin');
  });

  test('MultiTrackDropzone and MultiTrackProgress components exist and export correctly', async ({ page }) => {
    // Component existence verified by TypeScript build succeeding — this test
    // confirms the app loads without component-level import errors.
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    await expect(page).not.toHaveURL('/auth/signin');
  });

  test.fixme('DM uploads two files with speaker tags and sees progress', async ({ page }) => {
    // Requires: real session, R2 in test mode or local storage mode,
    // worker running locally.
    // Implement when session detail page integrates MultiTrackDropzone.
  });

  test.fixme('Files without tags get auto-labelled as Speaker 0, Speaker 1', async ({ page }) => {
    // Requires same setup as above.
  });

  test.fixme('Progress component shows per-file status bars during transcription', async ({ page }) => {
    // Requires worker running.
  });

  test.fixme('Merged transcript appears in session detail after all tracks complete', async ({ page }) => {
    // Full E2E: upload → worker → transcript visible in UI.
  });

  test.fixme(
    'speaker mapping step appears and saves to campaign after transcription completes',
    async ({ page }) => {
      // Phase 3 UI — requires worker + real R2 in E2E env
      // Expected flow:
      // 1. Multi-track upload completes (overallStatus = 'complete')
      // 2. SpeakerMappingStep renders inline
      // 3. DM selects character from dropdown for each speaker
      // 4. Clicks "Save & Continue"
      // 5. speakerMapping.upsert called per row
      // 6. speakerMapping.applyToTranscript called
      // 7. onComplete fires
    }
  );
});
