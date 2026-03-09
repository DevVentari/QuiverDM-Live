import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots');

test.describe('Portal Login Scene', () => {
  test('signin page renders full portal scene', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/auth/signin');

    // Wait for the form to be visible (confirms page loaded and hydrated)
    const signInBtn = page.getByRole('button', { name: /^sign in$/i });
    await expect(signInBtn).toBeVisible({ timeout: 10000 });

    // Portal scene container present
    await expect(page.locator('.portal-scene')).toBeVisible();

    // Portal ring present
    await expect(page.locator('.portal-ring')).toBeVisible();

    // Background video element present with correct sources
    const video = page.locator('video');
    await expect(video).toBeAttached();
    await expect(page.locator('source[src="/video/login-bg.webm"]')).toBeAttached();
    await expect(page.locator('source[src="/video/login-bg.mp4"]')).toBeAttached();

    // Email and password fields visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Screenshot — full portal scene (signin)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'portal-signin.png'),
      fullPage: false,
    });

    // Report console errors but do not fail here — captured below
    if (consoleErrors.length > 0) {
      console.warn('Console errors on signin page:', consoleErrors.join('\n'));
    }

    expect(consoleErrors, `Console errors on /auth/signin: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });

  test('signup page renders same portal scene', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/auth/signup');

    // Wait for the form to be visible
    const createBtn = page.getByRole('button', { name: /create account/i });
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // Portal scene container present on signup too
    await expect(page.locator('.portal-scene')).toBeVisible();
    await expect(page.locator('.portal-ring')).toBeVisible();

    // Screenshot — full portal scene (signup)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'portal-signup.png'),
      fullPage: false,
    });

    expect(consoleErrors, `Console errors on /auth/signup: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });

  test('signin form fields are functional', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 });

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    // Verify inputs accept text
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.fill('hunter2');
    await expect(passwordInput).toHaveValue('hunter2');

    // Password field should be masked
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('signin form shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/email/i).fill('notreal@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword123');
    // portal-form-float animation keeps the element in continuous motion — force:true bypasses stability check
    await page.getByRole('button', { name: /^sign in$/i }).click({ force: true });

    await expect(
      page.getByText(/invalid|error|incorrect|credentials/i)
    ).toBeVisible({ timeout: 10000 });

    // Screenshot the error state
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'portal-signin-error.png'),
      fullPage: false,
    });
  });

  test('particles are rendered when motion is not reduced', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 });

    // Particles use .portal-particle class
    const particles = page.locator('.portal-particle');
    const count = await particles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('portal fog layer is present', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.portal-fog')).toBeAttached();
  });

  test('video assets respond with 200', async ({ page }) => {
    const webmResponse = await page.request.get('/video/login-bg.webm');
    expect(webmResponse.status()).toBe(200);

    const mp4Response = await page.request.get('/video/login-bg.mp4');
    expect(mp4Response.status()).toBe(200);
  });
});
