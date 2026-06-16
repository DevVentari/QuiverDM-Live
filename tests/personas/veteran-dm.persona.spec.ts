import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists, ensureTestCampaignExists } from '../helpers';

const BLAKE_EMAIL = process.env.QA_BLAKE_EMAIL ?? 'blake@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign';

// A fully AI-generated scene, seeded directly via Prisma — same approach as
// tests/workflows/scenes.workflow.spec.ts. scenes.generate calls a real AI
// provider (non-deterministic, costs money), so the persona MUST NOT submit it.
// We seed a generated row and drive select → reveal → present against the real
// backend, while still asserting the compose form validates without invoking AI.
const SCENE_TITLE = `Veteran Scene ${Date.now()}`;
const SCENE_READ_ALOUD =
  'The war room is thick with candle smoke; a map of the marches lies pinned with daggers.';
const SCENE_DM_NOTES = 'The quartermaster is the traitor — he angles to send scouts into the ambush.';

test.beforeAll(async () => {
  await ensureTestUserExists(BLAKE_EMAIL, PASSWORD);
  await ensureTestCampaignExists(BLAKE_EMAIL, CAMPAIGN_SLUG, "Blake's Test Campaign");

  const campaign = await prisma.campaign.findUnique({ where: { slug: CAMPAIGN_SLUG } });
  if (!campaign) throw new Error(`Seed failed: campaign ${CAMPAIGN_SLUG} not found.`);

  // Clear presented flags so the present-to-players assertion is deterministic.
  await prisma.scene.updateMany({
    where: { campaignId: campaign.id },
    data: { isPresented: false },
  });

  await prisma.scene.create({
    data: {
      campaignId: campaign.id,
      title: SCENE_TITLE,
      type: 'theatre',
      description: SCENE_READ_ALOUD,
      dmNotes: SCENE_DM_NOTES,
      musicCue: 'low strings, distant wind',
      isPresented: false,
      linkedEntityIds: [] as unknown as Prisma.InputJsonValue,
      partyPresentIds: [] as unknown as Prisma.InputJsonValue,
      suggestedChecks: [
        { skill: 'Insight', dc: 15, note: 'read the quartermaster' },
      ] as unknown as Prisma.InputJsonValue,
      entityBeats: {} as Prisma.InputJsonValue,
      generatedAt: new Date(),
      promptInput: {
        intent: 'A tense war council in the keep before the march.',
        mood: 'theatre',
        linkedEntityIds: [],
        partyPresentIds: [],
      } as Prisma.InputJsonValue,
    },
  });
});

test('veteran-dm happy path: rapid campaign navigation and advanced npc creation', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'rapid-navigation', async () => {
    // Check for actual error page headings — not body text, which may contain "404" in session numbers
    const assertNoErrorPage = async () => {
      const errorHeading = page.locator('h1, h2').filter({ hasText: /^(404|not found|something went wrong|error)$/i });
      await expect(errorHeading).toHaveCount(0, { timeout: 3_000 });
    };

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await expect(page.getByText(/blake.s test campaign/i).or(page.getByText(/blakes test campaign/i)).first()).toBeVisible({ timeout: 10_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const sessionsOk = page.getByRole('heading', { name: /sessions/i })
      .or(page.getByText(/no sessions/i))
      .or(page.getByText(/plan your first/i))
      .or(page.locator('a[href*="/sessions/"]').first());
    await expect(sessionsOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const npcsOk = page.getByRole('heading', { name: /npcs/i })
      .or(page.getByText(/no npcs/i))
      .or(page.getByText(/create your first/i))
      .or(page.getByRole('link', { name: /new npc/i }));
    await expect(npcsOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/summaries`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const summariesOk = page.getByRole('heading', { name: /ai recaps/i })
      .or(page.getByRole('heading', { name: /recaps/i }))
      .or(page.getByRole('heading', { name: /summaries/i }))
      .or(page.getByText(/no recaps/i))
      .or(page.getByText(/no sessions/i));
    await expect(summariesOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();
  }, 50_000);

  await checkpoint(testInfo, 'campaign-switcher', async () => {
    await page.goto('/');
    await page.getByTestId('campaign-switcher-trigger').click();
    const switcherItems = page.locator('[data-testid^="campaign-switcher-item-"]');
    expect(await switcherItems.count()).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
  }, 15_000);

  const npcName = `QA Veteran NPC ${Date.now()}`;

  await checkpoint(testInfo, 'create-stat-block-npc', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await page.getByLabel(/^name$/i).fill(npcName);

    // Stat block section is collapsed by default — scroll to it and click to open
    const statBlockBtn = page.getByRole('button', { name: /d&d 5e stat block/i });
    await statBlockBtn.scrollIntoViewIfNeeded();
    await statBlockBtn.click();
    await page.waitForTimeout(400); // let accordion animate open

    await page.locator('#cr').fill('5');
    await page.locator('#hp').fill('52');
    await page.locator('#ac').fill('15');

    // Scroll submit button into view before clicking
    const submitBtn = page.getByRole('button', { name: /create npc/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    await page.waitForURL((url) => url.pathname.includes('/npcs/') && !url.pathname.endsWith('/new'), { timeout: 20_000 });
  }, 25_000);

  await checkpoint(testInfo, 'npc-detail-renders', async () => {
    const url = page.url();
    expect(url).toMatch(/\/npcs\//);
    expect(url).not.toMatch(/\/new/);

    await expect(page.getByText(npcName)).toBeVisible({ timeout: 10_000 });

    const statVisible = page.getByText('5').or(page.getByText('52')).or(page.getByText('15')).first();
    await expect(statVisible).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('body')).not.toContainText(/something went wrong|error loading|failed to load/i);
  }, 10_000);

  await checkpoint(testInfo, 'npc-voice-row-visible', async () => {
    // The NPC detail page renders a voice signature row for every NPC
    await expect(page.getByTestId('voice-row')).toBeVisible({ timeout: 10_000 });
  }, 15_000);
});

// AI scene creation, mid-prep. A veteran DM conjures a scene and pushes it live.
// Standalone test (mirrors the file's brain / prep-lifecycle tests) so it runs
// independently of the npc-creation happy path. The seeded scene (beforeAll)
// drives select → reveal → present; the compose form is opened to assert it
// validates, but never submitted — scenes.generate calls live AI.
test('veteran-dm scene creation: composes, reveals, and presents a scene', async ({ page }, testInfo) => {
  test.slow();

  const sceneNoCrash =
    /something went wrong|internal server error|unhandled error|client-side exception|application error|404 \| this page/i;

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 20_000);

  await checkpoint(testInfo, 'open-scenes-page', async () => {
    await page.goto(`/v3/campaigns/${CAMPAIGN_SLUG}/scenes`);
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
    await expect(page.getByText(/Theatre of the Mind/i).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: SCENE_TITLE }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(sceneNoCrash);
  }, 25_000);

  await checkpoint(testInfo, 'compose-form-validates', async () => {
    await page.getByRole('button', { name: '+ New Scene' }).click();
    await expect(page.getByText('New scene')).toBeVisible({ timeout: 8_000 });

    const create = page.getByRole('button', { name: /Create scene/i });
    // Submit stays disabled until a description is typed — no live AI call made.
    await expect(create).toBeDisabled();

    const describe = page.getByPlaceholder(/The party reaches the castle gates/i);
    await describe.fill('A torchlit war council in the keep, voices low.');
    await expect(create).toBeEnabled();

    // Cancel out without submitting — avoids the live AI generate call.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('body')).not.toContainText(sceneNoCrash);
  }, 20_000);

  await checkpoint(testInfo, 'select-scene-two-column-reveal', async () => {
    await page.getByRole('button', { name: SCENE_TITLE }).first().click();

    // LEFT column — player-facing: title + read-aloud.
    await expect(page.getByRole('heading', { name: SCENE_TITLE })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText('Read aloud')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(SCENE_READ_ALOUD)).toBeVisible({ timeout: 8_000 });

    // RIGHT column — DM only: secret beats / DM notes.
    await expect(page.getByText(/DM only — the board/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Secret beats')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(SCENE_DM_NOTES)).toBeVisible({ timeout: 8_000 });

    await expect(page.locator('body')).not.toContainText(sceneNoCrash);
  }, 25_000);

  await checkpoint(testInfo, 'present-scene-goes-live', async () => {
    await page.getByRole('button', { name: /Present to players/i }).click();
    // After presenting, the CTA flips to the live/clear state.
    await expect(page.getByRole('button', { name: /Live — clear/i })).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('body')).not.toContainText(sceneNoCrash);
  }, 25_000);
});

test('veteran-dm prep lifecycle: planned item can be worked to prepped', async ({ page }, testInfo) => {
  test.slow();

  await page.route('**/api/trpc/campaigns.getBySlug**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: { id: 'campaign-1', name: 'Test Campaign', myRole: 'OWNER' } } }]),
    });
  });
  await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
    });
  });
  await page.route('**/api/trpc/sessions.getById**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          result: {
            data: {
              id: 'test-session',
              title: 'Test Session',
              prepStatus: 'draft',
              prepData: { prepItems: [] },
            },
          },
        },
      ]),
    });
  });
  await page.route('**/api/trpc/sessions.updatePrep**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: { ok: true } } }]),
    });
  });
  await page.route('**/api/trpc/sessions.update**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: { ok: true } } }]),
    });
  });

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'open-prep-page', async () => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await expect(page.getByText('Prep Plan')).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'advance-prep-item', async () => {
    await page.getByPlaceholder('Add a prep item').fill('Bandit ambush at the river ford');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Bandit ambush at the river ford')).toBeVisible({ timeout: 8_000 });
    await page.getByText('Bandit ambush at the river ford').click();

    await page.getByRole('button', { name: 'Prep it' }).click();
    await expect(page.getByText('Prepping')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Prepped' }).click();
    await expect(page.getByText('Prepped')).toBeVisible({ timeout: 5_000 });
  }, 20_000);
});

test('veteran-dm brain-seeded-and-accessible checkpoint', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'brain-accessible-as-dm', async () => {
    // DM Brain must be accessible — no 404, no "DM only" locked state for Blake
    await expect(page.getByText(/DM Brain/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
    await expect(page.locator('body')).not.toContainText(/only accessible to dungeon masters/i);
  }, 10_000);

  await checkpoint(testInfo, 'brain-overview-tab-content', async () => {
    // Overview tab is default — World Pressure and Open Hooks sections should render
    await expect(page.getByText(/World Pressure/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Open Hooks/i).first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'seed-button-or-entities-present', async () => {
    // Either seed button (no entities yet) or entity cards (already seeded) must be visible
    const hasSeedBtn = await page.locator('[data-testid="seed-from-existing-btn"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEntityCards = await page.locator('[data-testid="entity-card"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSeedBtn || hasEntityCards).toBeTruthy();
  }, 10_000);

  await checkpoint(testInfo, 'brain-tabs-navigable', async () => {
    // All 4 tabs (Overview, Graph, Timeline, Warnings) must be present
    await expect(page.getByRole('tab', { name: /overview/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /graph/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /timeline/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /warnings/i }).first()).toBeVisible({ timeout: 5_000 });

    // Click Graph tab — must not crash
    await page.getByRole('tab', { name: /graph/i }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
  }, 15_000);
});

test('veteran-dm brain-seeded-from-creation: entities accessible after campaign creation with world setup', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 12_000);

  let campaignUrl: string;

  await checkpoint(testInfo, 'create-campaign-with-world-setup', async () => {
    // /campaigns/new redirects to /campaigns?create=true which opens the Sheet
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });

    const campaignName = `Blake Seed Test ${Date.now()}`;

    // Step 1: fill the campaign name (label is "Campaign Name *")
    await page.getByLabel(/campaign name/i).fill(campaignName);
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2: fill world anchors, then create
    await page.locator('#antagonistName').fill('The Shadow Dragon');
    await page.locator('#startingLocation').fill('Myth Drannor');
    await page.getByRole('button', { name: /create campaign/i }).click();

    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
    campaignUrl = page.url();
  }, 30_000);

  await checkpoint(testInfo, 'brain-page-loads-without-error', async () => {
    // Navigate to brain page for the newly created campaign
    const brainLink = page.locator('a[href*="/brain"]').first();
    const hasBrainLink = await brainLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBrainLink) {
      await brainLink.click();
    } else {
      await page.goto(campaignUrl.replace(/\/$/, '') + '/brain');
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    // Verify brain page loaded without a hard error — entity seeding is async and may not be visible yet
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
    await expect(page.locator('body')).not.toContainText(/404|not found/i);
  }, 15_000);
});

test('veteran-dm failure path: blocked action surfaces clear actionable error', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'invalid-submit', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Submit without filling name — scroll button into view first
    const submitBtn = page.getByRole('button', { name: /create npc/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    // Validation error should appear — either aria-invalid on name field or destructive text
    const validationErr = page.locator('[aria-invalid="true"]#name')
      .or(page.locator('.text-destructive').filter({ hasText: /required|name/i }));
    await expect(validationErr.first()).toBeVisible({ timeout: 8_000 });

    // URL must still be /new — form blocked the submission
    expect(page.url()).toMatch(/\/new$/);
  }, 10_000);

  await checkpoint(testInfo, 'error-visible', async () => {
    const errEl = page.locator('.text-destructive').filter({ hasText: /required|name/i }).first();
    await expect(errEl).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('body')).not.toContainText(/500|something went wrong/i);
  }, 5_000);
});
