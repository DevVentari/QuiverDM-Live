import { test } from '@playwright/test';

test.fixme('DM edits a section, approves — status shows REVIEWED', async ({ page }) => {
  // Phase 6a — requires generated recap in DB, REVIEWED status persisted
  void page;
});

test.fixme('DM uses regen-with-note on a section — content updates in place', async ({ page }) => {
  // Phase 6a — requires Anthropic API key in E2E env
  void page;
});

test.fixme('navigate away with dirty edits — confirm dialog appears', async ({ page }) => {
  // Phase 6a — beforeunload guard
  void page;
});

test.fixme('DM shares approved recap to Discord — success toast shown', async ({ page }) => {
  // Phase 6b — requires Discord bot token + linked channel in test campaign
  void page;
});
