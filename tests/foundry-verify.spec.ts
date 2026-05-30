import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './helpers'

const ADMIN_EMAIL = 'dev@blakewales.au'
const ADMIN_PASS = 'TestPass123!'

test('world map page for T2 campaign — screenshot what renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))

  await signInAsTestUser(page, ADMIN_EMAIL, ADMIN_PASS)
  await page.goto('/campaigns/curse-of-strahd-t2/world-map')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'tests/screenshots/world-map-t2.png', fullPage: false })

  console.log('Console errors:', errors)

  const toolbar = page.locator('[data-testid="map-toolbar"]')
  const picker = page.locator('[role="dialog"]')
  const toolbarVisible = await toolbar.isVisible().catch(() => false)
  const pickerVisible = await picker.isVisible().catch(() => false)

  console.log('Toolbar visible:', toolbarVisible)
  console.log('Picker (dialog) visible:', pickerVisible)
  console.log('Page title:', await page.title())

  // If there are JS errors, surface them
  expect(errors).toHaveLength(0)
})
