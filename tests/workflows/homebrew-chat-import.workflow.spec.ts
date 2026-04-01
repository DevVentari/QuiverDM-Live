import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

// Intercept the chat endpoint so tests don't hit the real Anthropic API.
const MOCK_RESPONSE = {
  text: "I can see a magic sword stat block. I've extracted it below. Is the damage correct?",
  items: [{ name: 'Vorpal Edge', type: 'item', description: 'A razor-sharp longsword +2.', properties: {} }],
  messages: [
    { role: 'user', text: 'Please extract all D&D homebrew content from this file.' },
    {
      role: 'assistant',
      text: "I can see a magic sword stat block.\n```json\n{\"items\":[{\"name\":\"Vorpal Edge\",\"type\":\"item\",\"description\":\"A razor-sharp longsword +2.\",\"properties\":{}}]}\n```",
    },
  ],
};

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.describe('homebrew chat import', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);

    await page.route('/api/uploads/homebrew-import/chat', async (route) => {
      await route.fulfill({ json: MOCK_RESPONSE });
    });
    await page.route('/api/uploads/homebrew-import/save', async (route) => {
      await route.fulfill({ json: { saved: 1, errors: [] } });
    });
  });

  test('uploads a file, chats to refine, and saves', async ({ page }) => {
    await page.goto('/homebrew');

    // Open the dropdown and click the media import menu item
    await page.getByRole('button', { name: /add/i }).click();
    await page.getByRole('menuitem', { name: /photo/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Upload a file via the hidden file input
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({
      name: 'test-card.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    // Start chat — button text is "Start Chat"
    await page.getByRole('button', { name: /start chat/i }).click();

    // AI response appears
    await expect(page.getByText(/magic sword/i)).toBeVisible({ timeout: 10_000 });

    // Item appears in right panel — input in the Extracted items panel with value "Vorpal Edge"
    const itemNameInput = page.getByRole('dialog').locator('input:not([type="file"])').first();
    await expect(itemNameInput).toHaveValue('Vorpal Edge', { timeout: 10_000 });

    // Send a follow-up message — the Send button is icon-only, use the placeholder input + Enter
    await page.getByPlaceholder('Type a message…').fill('The damage is 1d8 slashing');
    await page.getByPlaceholder('Type a message…').press('Enter');

    // Save — button text is "Save 1 item"
    await page.getByRole('button', { name: /save 1 item/i }).click();

    // Done state — "1 item saved to your library." appears in the dialog
    await expect(page.getByRole('dialog').getByText(/1 item.+saved/i).first()).toBeVisible();
  });

  test('inline item name edit updates the panel', async ({ page }) => {
    await page.goto('/homebrew');
    await page.getByRole('button', { name: /add/i }).click();
    await page.getByRole('menuitem', { name: /photo/i }).click();

    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('magic sword'),
    });

    await page.getByRole('button', { name: /start chat/i }).click();

    // Item name input appears in the Extracted items panel — first input in dialog
    const nameInput = page.getByRole('dialog').locator('input:not([type="file"])').first();
    await expect(nameInput).toHaveValue('Vorpal Edge', { timeout: 10_000 });

    // Edit the item name inline
    await nameInput.fill('Blade of Dawn');
    await expect(nameInput).toHaveValue('Blade of Dawn');
  });
});
