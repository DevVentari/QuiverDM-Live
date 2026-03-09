import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';
import { classifyIntent } from '../../src/lib/voice/intent-classifier';
import { routeAction } from '../../src/lib/voice/action-router';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('intent classifier — navigate intent', () => {
  const intent = classifyIntent('go to sessions');
  expect(intent.type).toBe('navigate');
  expect(intent.target).toBe('sessions');
});

test('intent classifier — search intent', () => {
  const intent = classifyIntent('find Gornak the orc');
  expect(intent.type).toBe('search');
  expect(intent.target).toBe('Gornak the orc');
});

test('intent classifier — dice_roll intent with notation', () => {
  const intent = classifyIntent('roll 2d6');
  expect(intent.type).toBe('dice_roll');
  expect(intent.target).toMatch(/2d6/i);
});

test('intent classifier — dice_roll intent plain roll', () => {
  const intent = classifyIntent('roll dice');
  expect(intent.type).toBe('dice_roll');
});

test('intent classifier — create intent', () => {
  const intent = classifyIntent('create NPC');
  expect(intent.type).toBe('create');
  expect(intent.target.toLowerCase()).toContain('npc');
});

test('intent classifier — query intent', () => {
  const intent = classifyIntent('what happened last session');
  expect(intent.type).toBe('query');
});

test('intent classifier — unknown intent', () => {
  const intent = classifyIntent('lalala random words');
  expect(intent.type).toBe('unknown');
});

test('action router — navigate produces navigateTo path', () => {
  const intent = classifyIntent('go to sessions');
  const result = routeAction(intent, 'my-campaign');
  expect(result.navigateTo).toContain('/campaigns/my-campaign/sessions');
});

test('action router — dice roll produces response text', () => {
  const intent = classifyIntent('roll 1d20');
  const result = routeAction(intent, null);
  expect(result.response).toMatch(/rolling 1d20/i);
  expect(result.response).toMatch(/total/i);
});

test('action router — navigate with null slug falls back gracefully', () => {
  const intent = classifyIntent('go to dashboard');
  const result = routeAction(intent, null);
  expect(result.navigateTo).toBe('/dashboard');
});

test('action router — create NPC navigates to new NPC page', () => {
  const intent = classifyIntent('create NPC');
  const result = routeAction(intent, 'test-campaign');
  expect(result.navigateTo).toContain('/npcs/new');
});

test('voice button renders on campaign page', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-campaign', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'voice-button-visible', async () => {
    const voiceBtn = page.locator('button[title="Ask DM Brain (voice)"]');
    await expect(voiceBtn.first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);
});

test('mock SpeechRecognition API triggers intent routing', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-campaign', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'mock-speech-recognition', async () => {
    await page.evaluate(() => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        onresult: ((event: unknown) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                results: [[{ transcript: 'roll 1d20' }]],
              });
            }
          }, 100);
        }
        stop() {}
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    const voiceBtn = page.locator('button[title="Ask DM Brain (voice)"]');
    await voiceBtn.click();
    await page.waitForTimeout(2_000);

    const responsePopup = page.locator('.border-amber-500\\/30');
    const hasPopup = await responsePopup.first().isVisible().catch(() => false);
    expect(hasPopup).toBeTruthy();
  }, 15_000);
});

test('navigation intent triggers route change', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-campaign', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'mock-navigation-intent', async () => {
    await page.evaluate(() => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        onresult: ((event: unknown) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                results: [[{ transcript: 'navigate to brain' }]],
              });
            }
          }, 100);
        }
        stop() {}
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    const initialUrl = page.url();
    const voiceBtn = page.locator('button[title="Ask DM Brain (voice)"]');
    await voiceBtn.click();
    await page.waitForTimeout(3_000);

    const currentUrl = page.url();
    expect(currentUrl).not.toBe(initialUrl);
    expect(currentUrl).toContain('/brain');
  }, 20_000);
});
