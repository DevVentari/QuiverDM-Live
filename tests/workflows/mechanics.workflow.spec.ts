import { test, expect } from '@playwright/test'
import { signInAsTestUser } from '../helpers/auth'

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local'
const PASSWORD = process.env.QA_TEST_PASSWORD ?? ''

test.describe('Campaign mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
  })

  test('DM sees mechanics list with seeded RotFM secrets', async ({ page }) => {
    await page.goto('/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics')
    await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible()
    await expect(page.getByTestId('mechanic-filter-secret')).toContainText(/17/)
  })

  test('clicking a secret card opens inspector with hidden truth (DM view)', async ({ page }) => {
    await page.goto('/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics?kind=secret')
    await page.locator('[data-testid^="mechanic-card-"]').first().click()
    await expect(page.getByTestId('mechanic-inspector-sheet')).toBeVisible()
    await expect(page.getByText(/DM-only · Hidden truth/i)).toBeVisible()
  })
})
