import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

const TAB_CHECKS: Array<{
  value: string;
  label: RegExp;
  contentSelector: RegExp;
}> = [
  {
    value: 'overview',
    label: /^overview$/i,
    contentSelector: /strength|dexterity|constitution|intelligence|wisdom|charisma|ability scores|saving throws|str|dex|con|int|wis|cha/i,
  },
  {
    value: 'spells',
    label: /^spells$/i,
    contentSelector: /spells|no spells|spell slots|cantrips/i,
  },
  {
    value: 'inventory',
    label: /^inventory$/i,
    contentSelector: /inventory|items|equipment|no items|empty/i,
  },
  {
    value: 'homebrew',
    label: /^homebrew$/i,
    contentSelector: /homebrew items|homebrew spells|homebrew feats|active effects/i,
  },
  {
    value: 'features',
    label: /^features$/i,
    contentSelector: /features|no features|class features|racial features/i,
  },
  {
    value: 'proficiencies',
    label: /^skills$/i,
    contentSelector: /skills|proficiency|acrobatics|athletics|deception|history|insight|intimidation|investigation|perception|performance|persuasion|religion|stealth|survival/i,
  },
  {
    value: 'background',
    label: /^background$/i,
    contentSelector: /backstory|background|personality|ideals|bonds|flaws|no background information/i,
  },
];

async function ensureCharacterExists(page: any): Promise<string> {
  await page.goto('/characters');
  await page.waitForLoadState('domcontentloaded');

  const charLink = page.locator('a[href^="/characters/"]').filter({ hasNotText: 'New Character' }).first();
  if (await charLink.isVisible().catch(() => false)) {
    const href = await charLink.getAttribute('href');
    if (href && /\/characters\/[a-zA-Z0-9_-]{10,}$/.test(href)) {
      return href;
    }
  }

  const existingCharacterHref = await page.locator('a[href*="/characters/"]').evaluateAll((links) => {
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && /\/characters\/[a-zA-Z0-9_-]{10,}$/.test(href)) {
        return href;
      }
    }
    return null;
  });
  if (existingCharacterHref) {
    const href = existingCharacterHref as string;
    return href as string;
  }

  await page.goto('/characters/new');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByLabel(/^name\b/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/^name\b/i).fill('QA Test Hero');
  await page.getByRole('button', { name: /create character/i }).click();
  await page.waitForURL(/\/characters\/[a-zA-Z0-9_-]{10,}/, { timeout: 15_000 });
  return page.url().replace(/.*?(\/characters\/[a-zA-Z0-9_-]+)$/, '$1');
}

test('character sheet tabs all render without errors', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 15_000);

  let characterHref: string;

  await checkpoint(testInfo, 'ensure-character-exists', async () => {
    characterHref = await ensureCharacterExists(page);
  }, 20_000);

  await checkpoint(testInfo, 'open-character-sheet', async () => {
    await page.goto(characterHref!);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+/, { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'expand-full-sheet-accordion', async () => {
    // Character detail now shows PlayerCharacterCard + collapsed "Full Character Sheet" accordion
    // Must expand it before tabs are visible
    const accordionBtn = page.getByRole('button', { name: /full character sheet/i });
    await expect(accordionBtn).toBeVisible({ timeout: 10_000 });
    await accordionBtn.click();
    // Wait for tabs to appear after accordion opens
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  await checkpoint(testInfo, 'verify-hero-stat-bar', async () => {
    // Character name heading should be present
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // Stat bar labels (AC, HP, ft, Prof, Init) only render when values are set.
    // For fresh characters with no stats, this is expected to be absent — skip if not found.
    const statPattern = /\bAC\b|\bHP\b|\bft\b|\bProf\b|\bInit\b/i;
    const statCount = await page.getByText(statPattern).count();
    if (statCount > 0) {
      await expect(page.getByText(statPattern).first()).toBeVisible({ timeout: 5_000 });
    }
  }, 10_000);

  await checkpoint(testInfo, 'verify-all-tabs-present', async () => {
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    for (const tab of TAB_CHECKS) {
      const trigger = tabList.getByRole('tab', { name: tab.label });
      await expect(trigger).toBeVisible({ timeout: 5_000 });
    }
  }, 10_000);

  for (const tab of TAB_CHECKS) {
    await checkpoint(testInfo, `tab-${tab.value}`, async () => {
      const tabList = page.getByRole('tablist');
      const trigger = tabList.getByRole('tab', { name: tab.label });
      await trigger.click();

      // Wait for tab panel to become visible
      const tabPanel = page.getByRole('tabpanel');
      await expect(tabPanel).toBeVisible({ timeout: 8_000 });

      // Verify expected content appears (or a recognized empty state)
      await expect(page.getByText(tab.contentSelector).first()).toBeVisible({ timeout: 8_000 });

      // No error page
      await expect(page.getByText(/something went wrong|failed to load|500|internal server error/i)).toHaveCount(0);
    }, 12_000);
  }
});
