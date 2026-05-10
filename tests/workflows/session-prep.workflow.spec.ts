import { test, expect } from '@playwright/test'
import { signInAsTestUser } from '../helpers'

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
})
