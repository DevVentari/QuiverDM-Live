import { test, expect } from '@playwright/test'
import { signInAsTestUser } from '../helpers/auth'

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local'
const PASSWORD = process.env.QA_TEST_PASSWORD ?? ''

test.describe('Global search (⌘K)', () => {
  test('Ctrl+K opens the search dialog and the input takes focus', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('search-trigger')).toBeVisible()
    await page.keyboard.press('Control+K')
    await expect(page.getByTestId('search-dialog')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('clicking the trigger button opens the dialog', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('search-trigger').click()
    await expect(page.getByTestId('search-dialog')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('Escape closes the dialog', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('search-trigger').click()
    await expect(page.getByTestId('search-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('search-dialog')).not.toBeVisible()
  })

  test('typing a query surfaces grouped results from accessible campaigns', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('search-trigger').click()
    await expect(page.getByTestId('search-dialog')).toBeVisible()

    const input = page.getByTestId('search-input')
    // Use a generic seed term that should hit at least one indexed entity
    // for the test user's campaign membership; "the" is broad enough.
    await input.fill('the')

    // Debounce is 200ms; allow up to 3s for the network round-trip.
    const dialog = page.getByTestId('search-dialog')
    await expect(dialog).toContainText(/campaigns|sessions|npcs|world|homebrew/i, {
      timeout: 3000,
    })
  })

  test('selecting a result navigates and closes the dialog', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('search-trigger').click()
    const input = page.getByTestId('search-input')
    await input.fill('the')

    // Wait for at least one result to render under any group, then click the
    // first command item that isn't the "Recent" group's items.
    const dialog = page.getByTestId('search-dialog')
    await expect(dialog).toContainText(/campaigns|sessions|npcs|world|homebrew/i, {
      timeout: 3000,
    })

    const firstItem = dialog.locator('[cmdk-item]').first()
    await firstItem.click()
    await expect(page.getByTestId('search-dialog')).not.toBeVisible()
    // After navigating, the URL should have changed away from the home `/`.
    await expect(page).not.toHaveURL(/\/$/)
  })
})
