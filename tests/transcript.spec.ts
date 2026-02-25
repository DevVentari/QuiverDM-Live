import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

async function openFirstSessionDetail(page: Page): Promise<boolean> {
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');

  // Get href directly and navigate — avoids click-navigation race with waitForLoadState.
  const campaignLink = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
  if ((await campaignLink.count()) === 0) {
    return false;
  }

  const campaignHref = await campaignLink.getAttribute('href');
  if (!campaignHref) return false;

  // Navigate directly to sessions to avoid strict mode on sidebar vs tab nav links.
  await page.goto(`${campaignHref}/sessions`);
  await page.waitForLoadState('networkidle');

  const sessionHref = await page.locator('a[href*="/sessions/"]').evaluateAll((links) => {
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && /\/campaigns\/[^/]+\/sessions\/[^/]+$/.test(href)) {
        return href;
      }
    }
    return null;
  });

  if (!sessionHref) {
    return false;
  }

  await page.goto(sessionHref);
  await page.waitForLoadState('networkidle');
  return true;
}

async function openTranscriptTab(page: Page): Promise<boolean> {
  const transcriptTab = page.getByRole('tab', { name: /transcript/i });
  if ((await transcriptTab.count()) === 0) {
    return false;
  }

  await transcriptTab.click();
  await page.waitForLoadState('networkidle');
  return true;
}

function isDM(page: Page) {
  return page.getByText(/dungeon master|co-dm/i).count();
}

test.describe('Transcript', () => {
  test('session detail page loads and exposes transcript tab/section', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    // Edge case: transcript UI can be a tab depending on visibility settings.
    await expect(
      page.getByRole('tab', { name: /transcript/i })
        .or(page.getByText(/transcript/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('empty transcript state is shown when no transcripts exist', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const hasAnyTranscript = (await page.getByText(/show segments|transcript/i).count()) > 0 &&
      (await page.getByText(/no transcripts yet/i).count()) === 0;
    if (hasAnyTranscript) {
      test.skip(true, 'Session already has transcript data; empty-state assertion not applicable.');
      return;
    }

    // Edge case: empty transcripts should render guidance, not errors.
    await expect(page.getByText(/no transcripts yet/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/failed to load|500|error/i)).toHaveCount(0);
  });

  test('DM can edit transcript segment inline', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    if ((await isDM(page)) === 0) {
      test.skip(true, 'Current campaign role is not DM.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const showSegments = page.getByRole('button', { name: /show segments/i }).first();
    if ((await showSegments.count()) > 0) {
      await showSegments.click();
    }

    const editButtons = page.getByRole('button', { name: /edit segment text/i });
    if ((await editButtons.count()) === 0) {
      test.skip(true, 'No editable transcript segments are available.');
      return;
    }

    // Edge case: DM should be able to enter inline edit mode and save.
    await editButtons.first().click();
    const saveButton = page.getByRole('button', { name: /^save$/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    await expect(saveButton).toHaveCount(0);
  });

  test('DM can rename a speaker across transcript segments', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    if ((await isDM(page)) === 0) {
      test.skip(true, 'Current campaign role is not DM.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const showSegments = page.getByRole('button', { name: /show segments/i }).first();
    if ((await showSegments.count()) > 0) {
      await showSegments.click();
    }

    const renameButtons = page.getByRole('button', { name: /rename speaker/i });
    if ((await renameButtons.count()) === 0) {
      test.skip(true, 'No speaker-labelled segments are available.');
      return;
    }

    // Edge case: speaker renaming flow should expose input + save controls.
    const label = (await renameButtons.first().getAttribute('aria-label')) || '';
    const oldName = label.replace(/^rename speaker\s+/i, '').trim();
    const tempName = `${oldName} QA`;

    await renameButtons.first().click();
    const speakerInput = page.locator('input').filter({ hasText: '' }).first();
    await speakerInput.fill(tempName);
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await expect(page.getByText(tempName)).toBeVisible({ timeout: 10000 });

    const revertButton = page.getByRole('button', { name: new RegExp(`rename speaker ${tempName}`, 'i') }).first();
    if ((await revertButton.count()) > 0) {
      await revertButton.click();
      await speakerInput.fill(oldName);
      await page.getByRole('button', { name: /^save$/i }).first().click();
    }
  });

  test('player cannot edit transcript segments', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    if ((await isDM(page)) > 0) {
      test.skip(true, 'Current campaign role is DM; player restriction cannot be asserted.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const showSegments = page.getByRole('button', { name: /show segments/i }).first();
    if ((await showSegments.count()) > 0) {
      await showSegments.click();
    }

    // Edge case: non-DM users should not see edit controls.
    await expect(page.getByRole('button', { name: /edit segment text|rename speaker/i })).toHaveCount(0);
  });

  test('long transcript pages remain stable while scrolling', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const showSegments = page.getByRole('button', { name: /show segments/i }).first();
    if ((await showSegments.count()) > 0) {
      await showSegments.click();
    }

    const timestampCount = await page.getByText(/^\d{2}:\d{2}$/).count();
    if (timestampCount < 20) {
      test.skip(true, 'Not enough transcript segments to validate long-scroll behavior.');
      return;
    }

    // Edge case: large transcript should not crash while scrolling.
    await page.mouse.wheel(0, 2000);
    await page.mouse.wheel(0, 2000);
    await expect(page.getByText(/failed to load|500|error/i)).toHaveCount(0);
  });

  test('navigating away and back keeps transcript search state', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstSessionDetail(page);
    if (!opened) {
      test.skip(true, 'No session exists for transcript coverage.');
      return;
    }

    const hasTranscriptTab = await openTranscriptTab(page);
    if (!hasTranscriptTab) {
      test.skip(true, 'Transcript tab is unavailable for this session visibility.');
      return;
    }

    const search = page.getByRole('textbox', { name: /search transcripts/i });
    if ((await search.count()) === 0) {
      test.skip(true, 'Transcript search field is not available for this session.');
      return;
    }

    // Edge case: state should persist when user switches tabs and returns.
    const query = `state-${Date.now()}`;
    await search.fill(query);
    await page.getByRole('tab', { name: /recap/i }).click();
    await page.getByRole('tab', { name: /transcript/i }).click();

    await expect(page.getByRole('textbox', { name: /search transcripts/i })).toHaveValue(query);
  });
});
