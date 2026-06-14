import { test, expect } from '@playwright/test'
import { signInAsTestUser } from '../helpers'

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local'
const PASSWORD = process.env.QA_TEST_PASSWORD ?? ''

// All eight adapters surfaced on the Import Hub page.
const SOURCES = [
  'Notion',
  'Obsidian',
  'Google Docs',
  'Word (.docx)',
  'Markdown',
  'World Anvil',
  'Campfire',
  'Kanka',
] as const

test.describe('Import Hub — multi-source content import', () => {
  test('Compendium sidebar links into the Import Hub', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/homebrew', { waitUntil: 'domcontentloaded' })

    const importLink = page.getByRole('link', { name: /import from app \/ files/i })
    await expect(importLink).toBeVisible()
    await importLink.click()

    await expect(page).toHaveURL(/\/homebrew\/import$/)
    await expect(page.getByRole('heading', { name: /import content/i })).toBeVisible()
  })

  test('Import Hub renders a card for every supported source', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/homebrew/import', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /import content/i })).toBeVisible()
    for (const source of SOURCES) {
      await expect(page.getByText(source, { exact: true })).toBeVisible()
    }
  })

  test('clicking a source card opens its import dialog', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/homebrew/import', { waitUntil: 'domcontentloaded' })

    // Notion is an API-mode source — the dialog should prompt for connection params.
    await page.getByText('Notion', { exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/notion/i)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('a file-based source (Obsidian) exposes a file input in its dialog', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD)
    await page.goto('/homebrew/import', { waitUntil: 'domcontentloaded' })

    await page.getByText('Obsidian', { exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Obsidian imports a vault ZIP — the modal must offer a file picker.
    await expect(dialog.locator('input[type="file"]')).toBeAttached()
  })
})
