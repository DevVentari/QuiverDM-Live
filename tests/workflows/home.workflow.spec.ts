import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

test.describe('Home — session-first', () => {
  test('renders next-session hero with campaign context', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('next-session-hero')).toBeVisible()
  })

  test('renders CommandRail with 5 nav items', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('command-rail')).toBeVisible()
    await expect(page.getByTestId('rail-nav-home')).toBeVisible()
    await expect(page.getByTestId('rail-nav-world')).toBeVisible()
    await expect(page.getByTestId('rail-nav-compendium')).toBeVisible()
    await expect(page.getByTestId('rail-nav-characters')).toBeVisible()
    await expect(page.getByTestId('rail-nav-settings')).toBeVisible()
  })

  test('opens Brain summon on Cmd+K', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('brain-summon')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('brain-summon')).not.toBeVisible()
  })

  test('old dashboard URL redirects to home', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/')
  })
})
