import { test, expect } from '@playwright/test'
import { signInAsTestUser } from '../helpers'

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
})
