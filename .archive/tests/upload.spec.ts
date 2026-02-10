import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

const TEST_VIDEO = 'E:\\Users\\Office\\Videos\\2025-11-08 18-30-31(1).mp4';
const SERVER_URL = 'http://localhost:3006';

test.describe('Video Upload and Transcription', () => {
  test.setTimeout(120000); // 2 minutes for upload test

  test('should load the homepage without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to the page
    await page.goto(SERVER_URL);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check for errors
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log('Page errors found:', pageErrors);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });

    // Verify page loaded
    expect(pageErrors.length).toBe(0);

    console.log('✅ Homepage loaded successfully without errors');
  });

  test('should upload video file successfully', async ({ page }) => {
    // Listen for console messages
    page.on('console', (msg) => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
      console.error('Page error:', error);
    });

    // Navigate to the page
    console.log('📱 Navigating to homepage...');
    await page.goto(SERVER_URL);
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial-state.png', fullPage: true });

    // Look for file input
    console.log('🔍 Looking for file upload input...');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 10000 });

    // Upload the file
    console.log('📤 Uploading video file...');
    await fileInput.setInputFiles(TEST_VIDEO);

    // Wait a bit for upload to process
    await page.waitForTimeout(2000);

    // Take screenshot after file selection
    await page.screenshot({ path: 'test-results/02-file-selected.png', fullPage: true });

    // Wait for upload to complete (look for progress or completion indicators)
    console.log('⏳ Waiting for upload to complete...');

    // Wait for either:
    // 1. Upload progress to reach 100%
    // 2. Transcribe button to be enabled
    // 3. Upload success message
    try {
      await page.waitForFunction(() => {
        const progressText = document.body.textContent || '';
        return progressText.includes('100%') ||
               progressText.includes('Uploading... 100') ||
               progressText.includes('Selected:');
      }, { timeout: 60000 });

      console.log('✅ Upload completed');
    } catch (e) {
      console.log('⚠️ Upload progress indicator not found, checking for file info...');
    }

    // Take screenshot of upload completion
    await page.screenshot({ path: 'test-results/03-upload-complete.png', fullPage: true });

    // Look for the transcribe button
    console.log('🔍 Looking for transcribe button...');
    const transcribeButton = page.getByRole('button', { name: /transcribe/i });
    await expect(transcribeButton).toBeVisible({ timeout: 5000 });
    await expect(transcribeButton).toBeEnabled({ timeout: 5000 });

    // Take final screenshot
    await page.screenshot({ path: 'test-results/04-ready-to-transcribe.png', fullPage: true });

    // Check for errors
    expect(pageErrors.length).toBe(0);

    console.log('✅ Video upload test completed successfully');
  });

  test('should start transcription process', async ({ page }) => {
    // This test requires the previous upload to have completed
    test.setTimeout(180000); // 3 minutes

    // Listen for console messages
    page.on('console', (msg) => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    // Listen for network requests
    page.on('request', (request) => {
      if (request.url().includes('transcribe')) {
        console.log('📡 Transcription request:', request.method(), request.url());
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('transcribe')) {
        console.log('📥 Transcription response:', response.status());
        if (response.status() >= 400) {
          const body = await response.text();
          console.error('❌ Error response:', body);
        }
      }
    });

    // Navigate and upload file first
    console.log('📱 Setting up for transcription test...');
    await page.goto(SERVER_URL);
    await page.waitForLoadState('networkidle');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO);

    // Wait for upload
    await page.waitForTimeout(5000);

    // Take screenshot before clicking transcribe
    await page.screenshot({ path: 'test-results/05-before-transcribe.png', fullPage: true });

    // Click transcribe button
    console.log('🎙️ Clicking transcribe button...');
    const transcribeButton = page.getByRole('button', { name: /transcribe/i });
    await transcribeButton.click();

    // Wait a bit for the request to be sent
    await page.waitForTimeout(3000);

    // Take screenshot after clicking
    await page.screenshot({ path: 'test-results/06-transcription-started.png', fullPage: true });

    console.log('✅ Transcription test completed');
  });
});
