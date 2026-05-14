import { test, expect } from '@playwright/test'
import { checkpoint, signInAsTestUser } from '../helpers'

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local'
const PASSWORD = process.env.QA_TEST_PASSWORD ?? ''

test.describe('Home — session-first', () => {
  test('renders next-session hero with campaign context', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('next-session-hero')).toBeVisible()
  })

  test('next-session hero shows a real date label for an upcoming planning session', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const hero = page.getByTestId('next-session-hero')
    await expect(hero).toBeVisible()
    // Seed creates a planning session for tomorrow 19:00 — hero must surface
    // it as the next session, not fall through to "no session scheduled".
    await expect(hero).not.toContainText(/no session scheduled/i)
    await expect(hero).toContainText(/tonight|tomorrow|\b\w{3}\s+\d{1,2}\s+\w{3}\b/i)
  })

  test('renders CommandRail with V2 nav set', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('command-rail')).toBeVisible()
    // Spot-check a representative subset of the V2 mockup nav items.
    await expect(page.getByTestId('rail-nav-home')).toBeVisible()
    await expect(page.getByTestId('rail-nav-campaigns')).toBeVisible()
    await expect(page.getByTestId('rail-nav-sessions')).toBeVisible()
    await expect(page.getByTestId('rail-nav-npcs')).toBeVisible()
    await expect(page.getByTestId('rail-nav-party')).toBeVisible()
    await expect(page.getByTestId('rail-nav-lore')).toBeVisible()
    await expect(page.getByTestId('rail-nav-settings')).toBeVisible()
  })

  test('opens Brain summon from the shell trigger', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const trigger = page.getByRole('button', { name: /open brain/i })
    await trigger.waitFor({ state: 'visible' })
    await page.waitForLoadState('networkidle')
    await trigger.click()
    await expect(page.getByTestId('brain-summon')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('brain-summon')).not.toBeVisible()
  })

  test('old dashboard URL redirects to home', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL('/')
  })

  test('home shows the Party row with PARTY overline', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const partyRow = page.getByTestId('party-row')
    await expect(partyRow).toBeVisible()
    await expect(partyRow).toContainText(/PARTY/)
  })

  test('home prep reminders show active prep items', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/campaigns.getActive**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            result: {
              data: {
                id: 'campaign-1',
                name: 'Test Campaign',
                slug: 'test-campaign',
                role: 'OWNER',
                bannerUrl: null,
                nextSession: null,
                createdAt: new Date().toISOString(),
                sessionCount: 2,
                npcCount: 0,
                locationCount: 0,
                itemCount: 0,
              },
            },
          },
        ]),
      })
    })
    await page.route('**/api/trpc/sessions.getAll**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            result: {
              data: [
                {
                  id: 'planning-session',
                  title: 'Prep Night',
                  status: 'planning',
                  prepData: {
                    prepItems: [
                      {
                        id: 'prep-1',
                        title: 'Bandit ambush at the river ford',
                        status: 'prepping',
                        objective: 'Decide the encounter beat and fallout.',
                        notes: '',
                        outcome: '',
                      },
                    ],
                    reminders: [
                      {
                        id: 'reminder-1',
                        title: 'Print initiative cards',
                        description: '',
                        completed: false,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ]),
      })
    })
    await page.route('**/api/trpc/characters.getCampaignCharacters**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: [] } }]),
      })
    })

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    }, 15_000)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Prep Reminders')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bandit ambush at the river ford' })).toHaveAttribute(
      'href',
      '/campaigns/test-campaign/sessions/prep?sessionId=planning-session',
    )
    await expect(page.getByRole('link', { name: 'Print initiative cards' })).toHaveAttribute(
      'href',
      '/campaigns/test-campaign/sessions/prep?sessionId=planning-session',
    )
    await expect(page.getByText('Print initiative cards')).toBeVisible()
  })
})
