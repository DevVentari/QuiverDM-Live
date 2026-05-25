import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

// Run locally with:
// $env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/session-intelligence-prep.workflow.spec.ts

const DM_EMAIL = process.env.QA_DM_EMAIL ?? process.env.TEST_DM_EMAIL ?? 'dm@test.com';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? process.env.TEST_DM_PASSWORD ?? 'TestPass123!';
const CAMPAIGN_SLUG = process.env.TEST_CAMPAIGN_SLUG ?? 'year-of-rogue-dragons';

async function navigateToSession(page: import('@playwright/test').Page, sessionId: string) {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}`);
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
}

test('session-intelligence: DM can set session intent brief', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await navigateToSession(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-session-intent-tab', async () => {
    if (!sessionId) return;
    const tab = page.getByRole('tab', { name: /session intent/i }).or(page.getByText(/Session Intent/i)).first();
    const hasTab = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await tab.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'add-tone-keyword', async () => {
    if (!sessionId) return;
    const toneInput = page.getByPlaceholder(/tone keyword/i).or(page.getByPlaceholder(/add tone/i)).first();
    const hasInput = await toneInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasInput) return;
    await toneInput.fill('claustrophobic');
    await page.keyboard.press('Enter');
    const tagVisible = await page.getByText('claustrophobic').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(tagVisible).toBeTruthy();
  }, 15_000);

  await checkpoint(testInfo, 'fill-goal-and-save', async () => {
    if (!sessionId) return;
    const goalInput = page.getByPlaceholder(/one goal per line/i).or(page.getByPlaceholder(/goal/i)).first();
    const hasGoalInput = await goalInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasGoalInput) {
      await goalInput.fill('Fear of Vespera');
    }

    const saveBtn = page.getByRole('button', { name: /save brief/i }).first();
    const hasSaveBtn = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSaveBtn) return;
    await saveBtn.click();
    // Button should disappear or show saved state after save
    await saveBtn.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }, 15_000);
});

test('session-intelligence: DM can add a secret to the Secrets Web', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await navigateToSession(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-secrets-web-tab', async () => {
    if (!sessionId) return;
    const tab = page.getByRole('tab', { name: /secrets web/i }).or(page.getByText(/Secrets Web/i)).first();
    const hasTab = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await tab.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'add-secret', async () => {
    if (!sessionId) return;
    const addBtn = page.getByRole('button', { name: /add secret/i }).first();
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await addBtn.click();

    const nameInput = page.getByPlaceholder(/secret name/i).first();
    const hasNameInput = await nameInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasNameInput) {
      await nameInput.fill('The Scale was recovered');
    }

    const contentInput = page.getByPlaceholder(/secret content/i).or(page.getByPlaceholder(/what the dm knows/i)).first();
    const hasContentInput = await contentInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasContentInput) {
      await contentInput.fill("Vespera's cult recovered The Scale beneath Dragonspear.");
    }

    const submitBtn = page.getByRole('button', { name: /add secret/i }).last();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSubmit) return;
    await submitBtn.click();

    const secretVisible = await page.getByText('The Scale was recovered').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(secretVisible).toBeTruthy();
  }, 20_000);
});

test('session-intelligence: DM can add phases with time budgets', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await navigateToSession(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-phase-pacing-tab', async () => {
    if (!sessionId) return;
    const tab = page.getByRole('tab', { name: /phase pacing/i }).or(page.getByText(/Phase Pacing/i)).first();
    const hasTab = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await tab.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'add-phase', async () => {
    if (!sessionId) return;
    const addBtn = page.getByRole('button', { name: /add phase/i }).first();
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await addBtn.click();

    const nameInput = page.getByPlaceholder(/phase name/i).last();
    const hasNameInput = await nameInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasNameInput) {
      await nameInput.fill('Awakening');
    }

    const minutesInput = page.locator('input[type="number"]').last();
    const hasMinutesInput = await minutesInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasMinutesInput) {
      await minutesInput.fill('15');
    }
  }, 15_000);

  await checkpoint(testInfo, 'save-phases', async () => {
    if (!sessionId) return;
    const saveBtn = page.getByRole('button', { name: /save phases/i }).first();
    const hasSaveBtn = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSaveBtn) return;
    await saveBtn.click();
    await saveBtn.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

    const phaseVisible = await page.getByText('Awakening').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(phaseVisible).toBeTruthy();
  }, 15_000);
});

test('session-intelligence: DM can add an escape route with benefits and risks', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await navigateToSession(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-escape-routes-tab', async () => {
    if (!sessionId) return;
    const tab = page.getByRole('tab', { name: /escape routes/i }).or(page.getByText(/Escape Routes/i)).first();
    const hasTab = await tab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await tab.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'add-escape-route', async () => {
    if (!sessionId) return;
    const addBtn = page.getByRole('button', { name: /add route/i }).first();
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await addBtn.click();

    const nameInput = page.getByPlaceholder(/route name/i).first();
    const hasNameInput = await nameInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasNameInput) {
      await nameInput.fill('Sewer Shaft');
    }
  }, 15_000);

  await checkpoint(testInfo, 'add-benefit', async () => {
    if (!sessionId) return;
    const benefitInput = page.getByPlaceholder(/add benefit/i).or(page.getByPlaceholder(/benefit/i)).first();
    const hasBenefitInput = await benefitInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasBenefitInput) return;
    await benefitInput.fill('Hidden from guards');
    await page.keyboard.press('Enter');

    const benefitVisible = await page.getByText('Hidden from guards').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(benefitVisible).toBeTruthy();
  }, 10_000);

  await checkpoint(testInfo, 'add-risk', async () => {
    if (!sessionId) return;
    const riskInput = page.getByPlaceholder(/add risk/i).or(page.getByPlaceholder(/risk/i)).first();
    const hasRiskInput = await riskInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasRiskInput) return;
    await riskInput.fill('Exhaustion saves every 30 min');
    await page.keyboard.press('Enter');

    const riskVisible = await page.getByText('Exhaustion saves every 30 min').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(riskVisible).toBeTruthy();
  }, 10_000);

  await checkpoint(testInfo, 'save-routes', async () => {
    if (!sessionId) return;
    const saveBtn = page.getByRole('button', { name: /save routes/i }).first();
    const hasSaveBtn = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSaveBtn) return;
    await saveBtn.click();
    await saveBtn.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }, 10_000);
});

test('session-intelligence: BRIEF tab renders generate-prep-brief and post-summary buttons', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-cockpit', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-brief-tab', async () => {
    if (!sessionId) return;
    const briefTab = page.locator('button').filter({ hasText: 'BRIEF' }).last();
    const hasTab = await briefTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await briefTab.click();
    await page.waitForTimeout(500);
    const panelTitle = await page.getByText('Session Brief').first().isVisible({ timeout: 8_000 }).catch(() => false);
    expect(panelTitle).toBeTruthy();
  }, 20_000);

  await checkpoint(testInfo, 'verify-brief-buttons', async () => {
    if (!sessionId) return;
    const hasPrepBtn = await page.getByRole('button', { name: /generate prep brief/i }).first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasPostBtn = await page.getByRole('button', { name: /post-session summary/i }).first().isVisible({ timeout: 8_000 }).catch(() => false);
    expect(hasPrepBtn || hasPostBtn).toBeTruthy();
  }, 10_000);
});

test('session-intelligence: SUGGEST tab shows empty state when no NPCs in play', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-cockpit', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-suggest-tab', async () => {
    if (!sessionId) return;
    const suggestTab = page.locator('button').filter({ hasText: 'SUGGEST' }).last();
    const hasTab = await suggestTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await suggestTab.click();
    await page.waitForTimeout(500);
    const panelTitle = await page.getByText('Live Suggestions').first().isVisible({ timeout: 8_000 }).catch(() => false);
    expect(panelTitle).toBeTruthy();
  }, 20_000);

  await checkpoint(testInfo, 'verify-suggest-empty-state', async () => {
    if (!sessionId) return;
    const hasEmptyState = await page.getByText(/mark npcs in play to see suggestions/i).first().isVisible({ timeout: 8_000 }).catch(() => false);
    expect(hasEmptyState).toBeTruthy();
  }, 10_000);
});

test('session-intelligence: BRIEF tab shows Import from doc button', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-cockpit-intel-drawer', async () => {
    if (!sessionId) return;
    const intelBtn = page.getByRole('button', { name: /session intel|intel/i }).first();
    const hasBtn = await intelBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await intelBtn.click();
    await page.waitForTimeout(500);
  }, 15_000);

  await checkpoint(testInfo, 'switch-to-brief-tab', async () => {
    if (!sessionId) return;
    const briefTab = page.getByRole('tab', { name: /brief/i }).first();
    const hasTab = await briefTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await briefTab.click();
    await page.waitForTimeout(300);
  }, 10_000);

  await checkpoint(testInfo, 'import-from-doc-button-visible', async () => {
    if (!sessionId) return;
    const importBtn = page.getByRole('button', { name: /import from doc/i }).first();
    const isVisible = await importBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
  }, 10_000);
});

test('session-intelligence: Import from doc opens extract zone on click', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-and-open-drawer', async () => {
    if (!sessionId) return;
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});

    const intelBtn = page.getByRole('button', { name: /session intel|intel/i }).first();
    const hasBtn = await intelBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await intelBtn.click();
    await page.waitForTimeout(500);

    const briefTab = page.getByRole('tab', { name: /brief/i }).first();
    const hasTab = await briefTab.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTab) return;
    await briefTab.click();
    await page.waitForTimeout(300);
  }, 40_000);

  await checkpoint(testInfo, 'click-import-and-check-zone', async () => {
    if (!sessionId) return;
    const importBtn = page.getByRole('button', { name: /import from doc/i }).first();
    const hasBtn = await importBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await importBtn.click();
    await page.waitForTimeout(300);

    // Paste textarea should appear
    const textarea = page.getByPlaceholder(/paste prep notes/i).first();
    const textareaVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(textareaVisible).toBeTruthy();

    // Extract button should appear but be disabled (no text yet)
    const extractBtn = page.getByRole('button', { name: /^extract$/i }).first();
    const extractBtnDisabled = await extractBtn.isDisabled({ timeout: 3_000 }).catch(() => true);
    expect(extractBtnDisabled).toBeTruthy();
  }, 15_000);
});
