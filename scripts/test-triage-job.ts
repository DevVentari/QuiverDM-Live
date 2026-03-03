import dotenv from 'dotenv';
dotenv.config({ override: true });
import { addFeedbackTriageJob } from '../src/lib/queue/feedback-triage-queue';

async function main() {
  const result = await addFeedbackTriageJob({
    feedbackId: 'test-oauth-' + Date.now(),
    threadId: '1477831517790277748',
    type: 'bug',
    description: 'NPC quick recall fails to load when campaign has 50+ NPCs. Spinner shows indefinitely after clicking the NPC search button in the cockpit.',
    pageUrl: 'http://localhost:3847/campaigns/shadow-realm/sessions/abc123/live',
    consoleLogs: [
      { ts: Date.now() - 5000, level: 'error', msg: 'GET /api/trpc/npcs.getAll?input=... 500 Internal Server Error' },
      { ts: Date.now() - 3000, level: 'error', msg: 'TRPCClientError: Internal server error' },
    ],
    issueUrl: 'https://github.com/DevVentari/quiverdm-feedback/issues/5',
  });
  console.log('Enqueued:', result.id);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
