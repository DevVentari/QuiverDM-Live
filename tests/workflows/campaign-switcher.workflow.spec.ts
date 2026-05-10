import { expect, test } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3847'

test.describe('Campaign switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page.getByTestId('campaign-switcher-trigger')).toBeVisible()
  })

  test('switches active campaign from rail and persists across reload', async ({ page }) => {
    const initialLabel = (await page.getByTestId('campaign-switcher-trigger').innerText()).trim()

    await page.getByTestId('campaign-switcher-trigger').click()
    const items = page.locator('[data-testid^="campaign-switcher-item-"]')
    const count = await items.count()
    test.skip(count < 2, 'Test requires at least 2 campaigns for the dev user')

    let targetSlug: string | null = null
    for (let i = 0; i < count; i++) {
      const text = (await items.nth(i).innerText()).trim()
      const testid = await items.nth(i).getAttribute('data-testid')
      if (text !== initialLabel && testid) {
        targetSlug = testid.replace('campaign-switcher-item-', '')
        await items.nth(i).click()
        break
      }
    }
    expect(targetSlug).not.toBeNull()

    await page.waitForURL(`${BASE}/`)
    await expect(page.getByTestId('campaign-switcher-trigger')).not.toHaveText(initialLabel)

    const labelAfterSwitch = (await page.getByTestId('campaign-switcher-trigger').innerText()).trim()
    await page.reload()
    await expect(page.getByTestId('campaign-switcher-trigger')).toHaveText(labelAfterSwitch)
  })

  test('/campaigns shows grid with Active pill on active card', async ({ page }) => {
    await page.goto(`${BASE}/campaigns?fresh=1`)
    const cards = page.locator('[data-testid^="campaign-card-"]')
    await expect(cards.first()).toBeVisible()

    const activeCards = page.locator('[data-testid^="campaign-card-"]:has-text("Active")')
    await expect(activeCards).toHaveCount(1)
  })

  test('Set as active from kebab navigates to / and updates home', async ({ page }) => {
    await page.goto(`${BASE}/campaigns?fresh=1`)
    const cards = page.locator('[data-testid^="campaign-card-"]')
    const total = await cards.count()
    test.skip(total < 2, 'Test requires at least 2 campaigns for the dev user')

    let inactiveSlug: string | null = null
    for (let i = 0; i < total; i++) {
      const card = cards.nth(i)
      const isActive = (await card.locator('text=Active').count()) > 0
      if (!isActive) {
        const tid = await card.getAttribute('data-testid')
        if (tid) inactiveSlug = tid.replace('campaign-card-', '')
        break
      }
    }
    expect(inactiveSlug).not.toBeNull()

    await page.getByTestId(`campaign-card-kebab-${inactiveSlug}`).click()
    await page.getByTestId(`set-active-${inactiveSlug}`).click()

    await page.waitForURL(`${BASE}/`)
    await expect(page.getByTestId('campaign-switcher-trigger')).toBeVisible()
  })

  test('mobile: switcher visible at top of nav sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/`)
    await page.getByLabel('Open navigation').click()
    await expect(page.getByTestId('campaign-switcher-trigger')).toBeVisible()
  })
})
