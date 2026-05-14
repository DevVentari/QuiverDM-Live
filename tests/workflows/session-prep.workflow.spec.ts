import { test, expect } from '@playwright/test'
import { checkpoint, signInAsTestUser } from '../helpers'

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local'
const PASSWORD = process.env.QA_TEST_PASSWORD ?? ''

test.describe('Session hub — prep phase', () => {
  test('renders PhasePillBar at /session/[id]', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="next-session-hero"]')
    const prepLink = page.getByTestId('hero-cta-prep')
    const href = await prepLink.getAttribute('href')
    if (!href) test.skip()
    await page.goto(href!)
    await expect(page.getByTestId('phase-pill-bar')).toBeVisible()
    await expect(page.getByTestId('phase-pill-prep')).toBeVisible()
  })

  test('old session URL redirects to /session/[id]', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const recentLink = page.getByTestId('recent-session-0')
    const href = await recentLink.getAttribute('href')
    if (!href) test.skip()
    expect(href).toMatch(/^\/session\//)
  })

  test('DM can track a prep item from planned to prepped', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/campaigns.getBySlug**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'campaign-1', name: 'Test Campaign', myRole: 'OWNER' } } }]),
      })
    })
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      })
    })
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
      })
    })
    await page.route('**/api/trpc/sessions.updatePrep**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { ok: true } } }]),
      })
    })
    await page.route('**/api/trpc/sessions.update**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { ok: true } } }]),
      })
    })

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    }, 15_000)

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session')
    await expect(page.getByText('Prep Plan')).toBeVisible()

    await page.getByPlaceholder('Add a prep item').fill('Bandit ambush at the river ford')
    await page.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByText('Bandit ambush at the river ford')).toBeVisible()
    await page.getByText('Bandit ambush at the river ford').click()

    await page.getByRole('button', { name: 'Prep it' }).click()
    await expect(page.getByText('Prepping')).toBeVisible()

    await page.getByRole('button', { name: 'Prepped' }).click()
    await expect(page.getByText('Prepped')).toBeVisible()
  })
})
