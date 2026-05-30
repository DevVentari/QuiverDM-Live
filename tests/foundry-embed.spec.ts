import { test, expect, BrowserContext } from '@playwright/test'
import { signInAsTestUser } from './helpers'

const ADMIN_EMAIL = 'dev@blakewales.au'
const ADMIN_PASS = 'TestPass123!'
const FOUNDRY_URL = 'https://foundry.nerdt.au'
const CAMPAIGN_SLUG = 'curse-of-strahd'
const GM_PASSWORD = '6614'

async function loginToFoundry(context: BrowserContext) {
  const foundryPage = await context.newPage()
  await foundryPage.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded' })

  // Select Gamemaster from the userid dropdown
  const userSelect = foundryPage.locator('select[name="userid"]')
  if (await userSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await userSelect.selectOption({ label: 'Gamemaster' })
  } else {
    // Fallback: click button with Gamemaster name
    const gmButton = foundryPage.locator('[data-user-name="Gamemaster"], [value="Gamemaster"]').first()
    if (await gmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gmButton.click()
    }
  }

  // Fill password
  const pwField = foundryPage.locator('input[type="password"], input[name="password"]').first()
  if (await pwField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pwField.fill(GM_PASSWORD)
  }

  // Submit
  const joinBtn = foundryPage.locator('button[type="submit"]').first()
  if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await joinBtn.click()
    await foundryPage.waitForURL(`${FOUNDRY_URL}/game`, { timeout: 20000 }).catch(() => {})
  }

  await foundryPage.screenshot({ path: 'tests/screenshots/foundry-after-login.png' })

  // Read cookies from context
  const cookies = await context.cookies([FOUNDRY_URL])
  console.log('Foundry cookies after login:', cookies.map(c => `${c.name}=${c.value.slice(0, 8)}... SameSite=${c.sameSite}`))

  // Force all foundry cookies to SameSite=None so cross-origin iframe can send them
  const updatedCookies = cookies.map(c => ({
    ...c,
    sameSite: 'None' as const,
    secure: true,
    domain: 'foundry.nerdt.au',
  }))
  await context.addCookies(updatedCookies)

  await foundryPage.close()
}

async function joinFoundryInIframe(frame: ReturnType<typeof import('@playwright/test').Page.prototype.frameLocator>) {
  // Select Gamemaster from dropdown in the join form inside the iframe
  const userSelect = frame.locator('select[name="userid"]')
  if (await userSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await userSelect.selectOption({ label: 'Gamemaster' })
  }

  // Enter GM password
  const pwField = frame.locator('input[type="password"], input[name="password"]').first()
  if (await pwField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pwField.fill(GM_PASSWORD)
  }

  // Click join
  const joinBtn = frame.locator('button[type="submit"]').first()
  if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await joinBtn.click()
  }
}

test.use({
  launchOptions: {
    args: [
      '--disable-features=ThirdPartyStoragePartitioning,PartitionedCookies,SameSiteByDefaultCookies',
    ],
  },
})

test('foundry embed — direct game load', async ({ page, context }) => {
  // Step 1: establish Foundry session cookie in this browser context
  await loginToFoundry(context)

  // Step 2: sign into QuiverDM
  await signInAsTestUser(page, ADMIN_EMAIL, ADMIN_PASS)

  // Step 3: navigate to the dedicated Foundry route
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/foundry`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'tests/screenshots/foundry-route-loaded.png' })

  // Step 4: find the iframe
  const iframeEl = page.locator('iframe[title="FoundryVTT"]')
  await expect(iframeEl).toBeVisible({ timeout: 15000 })

  const frame = page.frameLocator('iframe[title="FoundryVTT"]')

  // Wait for iframe initial load
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'tests/screenshots/foundry-iframe-loaded.png' })

  // Check if game loaded directly (session cookie worked)
  let gameCanvas = frame.locator('#board, #canvas')
  let hasGameCanvas = await gameCanvas.first().isVisible({ timeout: 3000 }).catch(() => false)
  console.log('Game canvas visible (initial):', hasGameCanvas)

  if (!hasGameCanvas) {
    // Not logged in — check if on join page
    const joinBtn = frame.locator('button[type="submit"]')
    const hasJoinBtn = await joinBtn.first().isVisible({ timeout: 3000 }).catch(() => false)
    console.log('On join page:', hasJoinBtn)

    if (hasJoinBtn) {
      // Fill in the join form with Gamemaster credentials and submit
      await joinFoundryInIframe(frame)
      console.log('Submitted join form with GM credentials')

      // Wait for game to load (Foundry needs time to initialize)
      await page.waitForTimeout(20000)
      await page.screenshot({ path: 'tests/screenshots/foundry-after-join.png' })

      gameCanvas = frame.locator('#board, #canvas')
      hasGameCanvas = await gameCanvas.first().isVisible({ timeout: 10000 }).catch(() => false)
      console.log('Game canvas after join:', hasGameCanvas)
    } else {
      // Capture iframe for debugging
      const iframeContent = await frame.locator('body').innerHTML().catch(() => 'could not read')
      console.log('iframe body (first 2000 chars):', iframeContent.slice(0, 2000))
    }
  }

  await page.screenshot({ path: 'tests/screenshots/foundry-final.png' })
  expect(hasGameCanvas).toBeTruthy()
})
