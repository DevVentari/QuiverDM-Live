import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAsTestUser, ensureTestUserExists, TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../helpers';

const BASE          = process.env.BASE_URL         ?? 'http://localhost:3847';
const BLAKE_EMAIL   = process.env.QA_BLAKE_EMAIL   ?? TEST_USER_EMAIL;
const PASSWORD      = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign';

const SEVERITY_FILTER = ['critical', 'serious'] as const;

async function injectLight(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.classList.add('light'));
}

/**
 * Materialise two CSS token variables into computed rgb() colours, then
 * compute the WCAG 2.1 contrast ratio between them.
 *
 * Must run AFTER html.light is injected — the probe reads the live token values.
 */
async function wcagRatio(page: Page, textToken: string, bgToken: string): Promise<number> {
  return page.evaluate(
    ([t, b]: [string, string]) => {
      // Chrome returns oklch(...) from getComputedStyle when tokens use oklch().
      // Convert OKLCH → linear sRGB directly (linear sRGB = WCAG relative luminance weights).
      function lumOklch(css: string): number | null {
        const m = css.match(/oklch\s*\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
        if (!m) return null;
        const L = parseFloat(m[1]), C = parseFloat(m[2]), H = parseFloat(m[3]);
        const hr = H * Math.PI / 180;
        const a = C * Math.cos(hr), bOk = C * Math.sin(hr);
        const l_ = L + 0.3963377774 * a + 0.2158037573 * bOk;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * bOk;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * bOk;
        const lc = l_ ** 3, mc = m_ ** 3, sc = s_ ** 3;
        const r = Math.max(0,  4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
        const g = Math.max(0, -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
        const bv = Math.max(0, -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc);
        return 0.2126 * r + 0.7152 * g + 0.0722 * bv;
      }
      // Fallback for rgb(r, g, b) serialization
      function lumRgb(css: string): number {
        const m = css.match(/\d+/g);
        if (!m || m.length < 3) return 0;
        return [0.2126, 0.7152, 0.0722].reduce((acc: number, w: number, i: number) => {
          const s = parseInt(m[i]) / 255;
          const lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          return acc + lin * w;
        }, 0);
      }
      function lum(css: string): number {
        return lumOklch(css) ?? lumRgb(css);
      }
      const probe = document.createElement('div');
      probe.style.cssText = `
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        color: var(${t});
        background-color: var(${b});
      `;
      document.body.appendChild(probe);
      const { color, backgroundColor } = getComputedStyle(probe);
      document.body.removeChild(probe);
      const L1 = Math.max(lum(color), lum(backgroundColor));
      const L2 = Math.min(lum(color), lum(backgroundColor));
      return (L1 + 0.05) / (L2 + 0.05);
    },
    [textToken, bgToken] as [string, string],
  );
}

// ── Token contrast pairs ──────────────────────────────────────────────────────
// min 4.5 = WCAG AA normal text  |  min 3.0 = WCAG AA large/secondary text

const CONTRAST_PAIRS = [
  { text: '--q-text',         bg: '--q-bg',             min: 4.5 },
  { text: '--q-text',         bg: '--q-surface-flat',   min: 4.5 },
  { text: '--q-text',         bg: '--q-surface-raised', min: 4.5 },
  { text: '--q-text',         bg: '--q-surface-sunken', min: 4.5 },
  { text: '--q-text-dim',     bg: '--q-bg',             min: 4.5 },
  { text: '--q-text-dim',     bg: '--q-surface-flat',   min: 4.5 },
  { text: '--q-text-dim',     bg: '--q-surface-raised', min: 4.5 },
  { text: '--q-text-faint',   bg: '--q-bg',             min: 3.0 },
  { text: '--q-text-faint',   bg: '--q-surface-flat',   min: 3.0 },
  { text: '--q-text-info',    bg: '--q-bg',             min: 3.0 },
  { text: '--q-text-info',    bg: '--q-surface-flat',   min: 3.0 },
  { text: '--q-text-info',    bg: '--q-surface-raised', min: 3.0 },
  { text: '--q-text-warning', bg: '--q-bg',             min: 3.0 },
  { text: '--q-text-warning', bg: '--q-surface-flat',   min: 3.0 },
  { text: '--q-text-danger',  bg: '--q-bg',             min: 4.5 },
  { text: '--q-text-danger',  bg: '--q-surface-flat',   min: 4.5 },
] as const;

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('token contrast audit — light mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/dev/design-system`);
    await page.waitForLoadState('domcontentloaded');
    await injectLight(page);
  });

  for (const pair of CONTRAST_PAIRS) {
    test(`contrast: ${pair.text} on ${pair.bg} >= ${pair.min}`, async ({ page }) => {
      const ratio = await wcagRatio(page, pair.text, pair.bg);
      expect(
        ratio,
        `${pair.text} on ${pair.bg}: ratio ${ratio.toFixed(2)} < ${pair.min} (WCAG ${pair.min === 4.5 ? 'AA normal' : 'AA large'})`,
      ).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

test.describe('live pages axe — light mode', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(BLAKE_EMAIL, PASSWORD);
  });

  async function axeLightScan(page: Page, route: string) {
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    await injectLight(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    return results.violations.filter((v) =>
      (SEVERITY_FILTER as readonly string[]).includes(v.impact ?? ''),
    );
  }

  test('dashboard has no critical/serious violations in light mode', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeLightScan(page, '/dashboard');
    expect(
      violations,
      `Axe violations on /dashboard (light):\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`,
    ).toHaveLength(0);
  });

  test('campaigns list has no critical/serious violations in light mode', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeLightScan(page, '/campaigns');
    expect(
      violations,
      `Axe violations on /campaigns (light):\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`,
    ).toHaveLength(0);
  });

  test('campaign overview has no critical/serious violations in light mode', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeLightScan(page, `/campaigns/${CAMPAIGN_SLUG}`);
    expect(
      violations,
      `Axe violations on /campaigns/${CAMPAIGN_SLUG} (light):\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`,
    ).toHaveLength(0);
  });
});
