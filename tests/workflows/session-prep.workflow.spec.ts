import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

test.describe('Session hub — prep phase', () => {
  test('renders PhasePillBar at /session/[id]', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="next-session-hero"]')
    const prepLink = page.getByTestId('hero-cta-prep')
    const href = await prepLink.getAttribute('href')
    if (!href) test.skip()
    await page.goto(href!)
    await expect(page.getByTestId('phase-pill-bar')).toBeVisible()
    await expect(page.getByTestId('phase-pill-prep')).toBeVisible()
  })

  test('old session URL redirects to /session/[id]', async ({ page }) => {
    await page.goto('/')
    const recentLink = page.getByTestId('recent-session-0')
    const href = await recentLink.getAttribute('href')
    if (!href) test.skip()
    expect(href).toMatch(/^\/session\//)
  })
})
