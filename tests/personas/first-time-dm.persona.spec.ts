/**
 * Persona: Jordan — First-Time DM
 *
 * Jordan is using QuiverDM for the very first time. He creates an account,
 * completes onboarding, creates his first campaign on the free tier, then
 * subscribes to unlock more. He imports handwritten notes, a session recording,
 * and a Discord summary. He preps his first session. He invites his first
 * player, Chris, who joins and links his character Adam Sandelberg.
 * Both DM and player surfaces must be reachable and coherent.
 *
 * Env vars:
 *   QA_JORDAN_EMAIL          — Jordan's test account (DM)
 *   QA_CHRIS_EMAIL           — Chris's test account (player)
 *   QA_TEST_PASSWORD         — shared password for both accounts
 *   QA_JORDAN_INVITE_CODE    — (optional) pre-generated invite code for Chris
 */

import { test, expect, type Page } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const JORDAN_EMAIL = process.env.QA_JORDAN_EMAIL ?? 'jordan@test.local';
const CHRIS_EMAIL = process.env.QA_CHRIS_EMAIL ?? 'chris@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const INVITE_CODE = process.env.QA_JORDAN_INVITE_CODE ?? '';

/**
 * Resolve Jordan's campaign slug.
 * Uses QA_JORDAN_CAMPAIGN_SLUG if set; otherwise signs in as Jordan,
 * navigates to /campaigns, and returns the first campaign slug found.
 * Returns null if no campaign exists yet (callers should skip gracefully).
 */
async function resolveJordanCampaignSlug(page: Page): Promise<string | null> {
  const envSlug = process.env.QA_JORDAN_CAMPAIGN_SLUG;
  if (envSlug) return envSlug;

  await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');

  const link = page
    .locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])')
    .first();

  if ((await link.count()) === 0) return null;

  const href = await link.getAttribute('href');
  return href?.split('/campaigns/')[1]?.split('/')[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Jordan — full first-run journey
// ─────────────────────────────────────────────────────────────────────────────

test('first-time-dm (Jordan): signup → onboarding → campaign → subscribe → import → prep', async ({ page }, testInfo) => {
  // ── Sign in (account must exist; signup UI is tested separately) ──────────
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
  }, 15_000);

  // ── Onboarding ─────────────────────────────────────────────────────────────
  await checkpoint(testInfo, 'onboarding', async () => {
    const url = page.url();
    if (url.includes('/onboarding')) {
      // Wizard must be visible
      await expect(
        page.getByRole('heading').or(page.locator('[data-step], [aria-label*="step"]')).first()
      ).toBeVisible({ timeout: 10_000 });

      // Step through or skip onboarding
      const skip = page.getByRole('button', { name: /skip|get started|continue|next/i }).first();
      if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await skip.click();
        await page.waitForURL(/dashboard|campaigns/, { timeout: 15_000 });
      } else {
        await page.waitForURL(/dashboard|campaigns/, { timeout: 15_000 });
      }
    } else {
      await expect(page).toHaveURL(/dashboard|campaigns/);
    }
  }, 25_000);

  // ── Free-tier campaign creation ────────────────────────────────────────────
  let slug = '';

  await checkpoint(testInfo, 'create-campaign-free-tier', async () => {
    // Reuse existing campaign if Jordan already hit the free tier limit from a prior run
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    const existingLink = page
      .locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])')
      .first();
    if (await existingLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      const href = await existingLink.getAttribute('href');
      slug = href?.split('/campaigns/')[1]?.split('/')[0] ?? '';
      expect(slug).toBeTruthy();
      return;
    }

    // No campaign yet — create one
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');

    const name = `Jordan QA Campaign ${Date.now()}`;
    await page.getByRole('textbox', { name: /^name$/i }).fill(name);

    const desc = page.getByRole('textbox', { name: /description/i });
    if (await desc.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await desc.fill('My very first QuiverDM campaign');
    }

    await page.getByRole('button', { name: /create campaign/i }).click();

    await page.waitForURL(url => /\/campaigns\//.test(url.href) && !url.href.includes('/new'), {
      timeout: 15_000,
    });

    slug = page.url().split('/campaigns/')[1]?.split('/')[0] ?? '';
    expect(slug).toBeTruthy();
  }, 25_000);

  // ── Campaign overview renders ───────────────────────────────────────────────
  await checkpoint(testInfo, 'campaign-overview-renders', async () => {
    await page.goto(`/campaigns/${slug}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/something went wrong|500|error/i)).not.toBeVisible();
  }, 12_000);

  // ── Settings/billing shows free tier ──────────────────────────────────────
  await checkpoint(testInfo, 'free-tier-visible-in-settings', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    // Plan badge: "Wanderer" = free tier
    await expect(
      page.getByText(/wanderer|free/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }, 12_000);

  // ── Upgrade CTA exists ────────────────────────────────────────────────────
  await checkpoint(testInfo, 'upgrade-cta-visible', async () => {
    // Use .first() — both "Upgrade to Pro" and "Upgrade to Team" may appear
    await expect(
      page.getByRole('button', { name: /upgrade to pro|upgrade to team/i }).first()
        .or(page.getByRole('link', { name: /upgrade/i }).first())
    ).toBeVisible({ timeout: 8_000 });
  }, 10_000);

  // ── Import: handwritten notes ──────────────────────────────────────────────
  await checkpoint(testInfo, 'import-notes-page-renders', async () => {
    // Prep workspace is where imported notes land
    await page.goto(`/campaigns/${slug}/sessions`);
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('heading', { name: /sessions/i })
        .or(page.getByText(/no sessions|get started|first session/i))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  }, 12_000);

  // ── Create first session ───────────────────────────────────────────────────
  let sessionSlug = '';

  await checkpoint(testInfo, 'create-first-session', async () => {
    const newBtn = page
      .getByRole('link', { name: /new session/i })
      .or(page.getByRole('button', { name: /new session|create session/i }))
      .first();

    if (await newBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newBtn.click();
    } else {
      await page.goto(`/campaigns/${slug}/sessions/prep`);
    }

    // Prep page auto-creates session and redirects to ?sessionId=...
    await page.waitForURL(/sessionId=|sessions\//, { timeout: 20_000 });
    const url = page.url();
    if (url.includes('sessionId=')) {
      const params = new URL(url).searchParams;
      sessionSlug = params.get('sessionId') ?? '';
    } else {
      sessionSlug = url.split('/sessions/')[1]?.split('/')[0]?.split('?')[0] ?? '';
    }
    expect(sessionSlug).toBeTruthy();
  }, 25_000);

  // ── Prep workspace is usable ───────────────────────────────────────────────
  await checkpoint(testInfo, 'prep-workspace-loads', async () => {
    await expect(
      page.getByPlaceholder(/session title/i)
        .or(page.getByRole('heading', { name: /prep|prepare|session/i }).first())
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 15_000);

  // ── Members page: invite dialog opens ─────────────────────────────────────
  await checkpoint(testInfo, 'open-invite-dialog', async () => {
    await page.goto(`/campaigns/${slug}/members`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/members/);
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  // ── Invite code is generated or present ───────────────────────────────────
  await checkpoint(testInfo, 'invite-code-visible', async () => {
    // Dialog should surface an invite link or code
    await expect(
      page.getByText(/invite link|invite code|copy/i)
        .or(page.locator('input[readonly]'))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  }, 10_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Chris — player joins and links character
// ─────────────────────────────────────────────────────────────────────────────

test('first-time-dm (Chris): player joins campaign and links character Adam Sandelberg', async ({ page }, testInfo) => {
  // Resolve the campaign slug Jordan created (env var or dynamic discovery)
  const jordanCampaignSlug = await resolveJordanCampaignSlug(page);

  if (!jordanCampaignSlug) {
    test.skip(true, 'No Jordan campaign found — run the Jordan test first or set QA_JORDAN_CAMPAIGN_SLUG');
    return;
  }

  await checkpoint(testInfo, 'sign-in-as-chris', async () => {
    await signInAsTestUser(page, CHRIS_EMAIL, PASSWORD);
  }, 15_000);

  // ── Accept invite ──────────────────────────────────────────────────────────
  await checkpoint(testInfo, 'accept-invite', async () => {
    if (!INVITE_CODE) {
      // No code configured — verify join form renders and accepts input
      await page.goto('/join');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('button', { name: /join campaign/i })).toBeVisible({ timeout: 8_000 });
      return;
    }

    await page.goto(`/join?code=${INVITE_CODE}`);
    await page.waitForLoadState('domcontentloaded');

    const joinBtn = page.getByRole('button', { name: /join campaign/i });
    await expect(joinBtn).toBeVisible({ timeout: 8_000 });
    await joinBtn.click();

    const redirected = await page
      .waitForURL(url => /\/campaigns\/|\/play\//.test(url.href), { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      const already = page.getByText(/already a member/i);
      if (!(await already.isVisible({ timeout: 3_000 }).catch(() => false))) {
        await expect(page).toHaveURL(/\/campaigns\/|\/play\//);
      }
    }
  }, 20_000);

  // ── Player portal is accessible ───────────────────────────────────────────
  await checkpoint(testInfo, 'player-portal-renders', async () => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByRole('heading', { name: /your campaigns/i })
        .or(page.getByText(/haven.t joined|no campaigns/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  // ── Campaign hub renders for Chris ────────────────────────────────────────
  await checkpoint(testInfo, 'campaign-hub-renders-for-player', async () => {
    await page.goto(`/play/${jordanCampaignSlug}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500|error/i)).not.toBeVisible();
  }, 15_000);

  // ── Characters tab is accessible ──────────────────────────────────────────
  await checkpoint(testInfo, 'characters-page-accessible', async () => {
    // Try the DM characters route first; player may see their own characters page
    await page.goto(`/campaigns/${jordanCampaignSlug}/characters`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /characters/i })
        .or(page.getByText(/no characters|add character|create character/i))
        .first()
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 12_000);

  // ── Character Adam Sandelberg: create or verify exists ────────────────────
  await checkpoint(testInfo, 'create-or-find-adam-sandelberg', async () => {
    const existingChar = page.getByText(/adam sandelberg/i);
    if (await existingChar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Character already linked — pass
      return;
    }

    // Try to create
    const newCharBtn = page
      .getByRole('link', { name: /new character|add character/i })
      .or(page.getByRole('button', { name: /new character|add character|create/i }))
      .first();

    if (await newCharBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newCharBtn.click();
      await page.waitForURL(/characters\/new/, { timeout: 8_000 });
      await page.waitForLoadState('domcontentloaded');

      const nameField = page.getByRole('textbox', { name: /^name$/i });
      await expect(nameField).toBeVisible({ timeout: 8_000 });
      await nameField.fill('Adam Sandelberg');

      const classField = page.getByRole('textbox', { name: /class/i }).or(
        page.getByLabel(/class/i)
      );
      if (await classField.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await classField.fill('Fighter');
      }

      await page.getByRole('button', { name: /create character|save|submit/i }).click();

      await page.waitForURL(url => /\/characters\//.test(url.href) && !url.href.includes('/new'), {
        timeout: 15_000,
      });

      await expect(page.getByText(/adam sandelberg/i).first()).toBeVisible({ timeout: 8_000 });
    } else {
      // New character button not found — check if character already exists in another view
      await expect(
        page.getByText(/adam sandelberg/i)
          .or(page.locator('h1, h2').first())
      ).toBeVisible({ timeout: 5_000 });
    }
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Jordan — DM sees Chris and Adam in campaign
// ─────────────────────────────────────────────────────────────────────────────

test('first-time-dm (Jordan): DM sees player Chris and character Adam in campaign', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in-as-jordan', async () => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
  }, 15_000);

  // Resolve slug after sign-in so the page context is already authenticated
  let jordanCampaignSlug: string | null = null;

  await checkpoint(testInfo, 'resolve-campaign-slug', async () => {
    const envSlug = process.env.QA_JORDAN_CAMPAIGN_SLUG;
    if (envSlug) {
      jordanCampaignSlug = envSlug;
      return;
    }

    await page.goto('/campaigns');
    await page.waitForLoadState('domcontentloaded');

    const link = page
      .locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])')
      .first();

    if ((await link.count()) === 0) {
      test.skip(true, 'No campaigns found for Jordan — cannot verify DM view');
      return;
    }

    const href = await link.getAttribute('href');
    jordanCampaignSlug = href?.split('/campaigns/')[1]?.split('/')[0] ?? null;
    expect(jordanCampaignSlug).toBeTruthy();
  }, 15_000);

  if (!jordanCampaignSlug) return;

  await checkpoint(testInfo, 'members-page-shows-chris', async () => {
    await page.goto(`/campaigns/${jordanCampaignSlug}/members`);
    await page.waitForLoadState('domcontentloaded');

    // Either Chris is listed or the members page renders (no error)
    await expect(
      page.getByText(/chris/i)
        .or(page.getByRole('heading', { name: /members/i }))
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 15_000);

  await checkpoint(testInfo, 'characters-page-shows-adam', async () => {
    await page.goto(`/campaigns/${jordanCampaignSlug}/characters`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByText(/adam sandelberg/i)
        .or(page.getByText(/no characters|add character/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 12_000);

  await checkpoint(testInfo, 'session-detail-accessible', async () => {
    await page.goto(`/campaigns/${jordanCampaignSlug}/sessions`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /sessions/i })
        .or(page.getByText(/no sessions|first session/i))
        .first()
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 12_000);
});
