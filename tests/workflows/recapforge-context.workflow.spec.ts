import { test } from '@playwright/test';

test.fixme('context extraction runs after multi-track transcription completes', async ({ page }) => {
  // Phase 4 — requires real context-extraction worker + AssemblyAI in E2E env
  // When implemented: upload multi-track files, wait for transcription, verify
  // CampaignContext records appear in campaign settings context section
});

test.fixme('sourcebook seeder creates context records from DDB sourcebook chapters', async ({ page }) => {
  // Phase 4 — requires DDB sourcebook synced to campaign
  // When implemented: navigate to campaign settings, click seed button,
  // verify toast shows correct count, verify records in DB
});
