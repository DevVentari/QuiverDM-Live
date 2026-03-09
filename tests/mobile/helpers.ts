import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3847';
export const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'demo1234';

const SCREENSHOT_BASE = path.resolve(__dirname, '../../docs/screenshots/mobile');

export async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|onboarding|campaigns|characters|homebrew|settings/, {
    timeout: 20000,
  });
}

export async function checkNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.bodyScrollWidth,
    `[${label}] Horizontal overflow: scrollWidth=${overflow.bodyScrollWidth} > innerWidth=${overflow.innerWidth}`
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

export async function checkTouchTargets(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll('button:not([disabled]), a[href], [role="button"]')
    );
    return els
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: ((el as HTMLElement).innerText ?? '').slice(0, 40).trim(),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter(r => r.w > 0 && r.h > 0 && (r.w < 44 || r.h < 44));
  });

  if (violations.length > 0) {
    const detail = violations
      .slice(0, 5)
      .map(v => `<${v.tag}> "${v.text}" ${v.w}x${v.h}px`)
      .join('; ');
    console.warn(`[${label}] ${violations.length} element(s) below 44x44px touch target: ${detail}`);
  }
}

export async function screenshot(page: Page, specName: string, name: string) {
  const dir = path.join(SCREENSHOT_BASE, specName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
}

export async function pageChecks(page: Page, label: string, specName: string, screenshotName: string) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await checkNoHorizontalOverflow(page, label);
  await checkTouchTargets(page, label);
  await screenshot(page, specName, screenshotName);
}
