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

  test('renders CommandRail with 5 nav items', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('command-rail')).toBeVisible()
    await expect(page.getByTestId('rail-nav-home')).toBeVisible()
    await expect(page.getByTestId('rail-nav-world')).toBeVisible()
    await expect(page.getByTestId('rail-nav-compendium')).toBeVisible()
    await expect(page.getByTestId('rail-nav-characters')).toBeVisible()
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
