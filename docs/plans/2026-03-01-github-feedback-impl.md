# GitHub Feedback Issues — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When feedback is submitted, create a GitHub issue in `DevVentari/quiverdm-feedback` and include the issue link in the Discord triage embed.

**Architecture:** `createGithubIssue()` is called inside `postDiscordThread` before the Discord thread is created. The returned `issueUrl` is passed to `addFeedbackTriageJob` via a new optional field on `FeedbackTriageJobData`. The worker passes it to `postTriageEmbed`, which adds a GitHub Issue link field to the Discord embed. If `GITHUB_TOKEN` is unset, issue creation is silently skipped.

**Tech Stack:** GitHub REST API v3 (fetch), BullMQ, Discord API, TypeScript

---

### Task 1: One-time repo + token setup

**This task is run once manually — not committed to code.**

**Step 1: Create the private feedback repo**

```bash
gh repo create DevVentari/quiverdm-feedback --private --description "QuiverDM user feedback issues"
```

Expected: `✓ Created repository DevVentari/quiverdm-feedback on GitHub`

**Step 2: Create labels**

```bash
gh label create bug --repo DevVentari/quiverdm-feedback --color "ee0701" --description "Bug report"
gh label create feature-request --repo DevVentari/quiverdm-feedback --color "5865f2" --description "Feature request"
```

**Step 3: Get a GitHub token**

```bash
gh auth token
```

Copy the token value.

**Step 4: Add env vars to local `.env`**

Open `E:\Projects\QuiverDM\.env` and add:
```
GITHUB_TOKEN=<token from step 3>
GITHUB_FEEDBACK_REPO=DevVentari/quiverdm-feedback
```

**Step 5: Add to Vercel**

```bash
cd E:/Projects/QuiverDM
vercel env add GITHUB_TOKEN production
# paste the token when prompted
vercel env add GITHUB_FEEDBACK_REPO production
# enter: DevVentari/quiverdm-feedback
```

---

### Task 2: Add `issueUrl` to `FeedbackTriageJobData`

**Files:**
- Modify: `src/lib/queue/feedback-triage-queue.ts`

**Step 1: Add the optional field to the interface**

Current interface (lines 21–28):
```ts
export interface FeedbackTriageJobData {
  feedbackId: string;
  threadId: string;
  type: string;
  description: string;
  pageUrl: string;
  consoleLogs: { ts: number; level: string; msg: string }[];
}
```

Change to:
```ts
export interface FeedbackTriageJobData {
  feedbackId: string;
  threadId: string;
  type: string;
  description: string;
  pageUrl: string;
  consoleLogs: { ts: number; level: string; msg: string }[];
  issueUrl?: string;
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (the field is optional, no call sites break).

**Step 3: Commit**

```bash
git add src/lib/queue/feedback-triage-queue.ts
git commit -m "feat(feedback): add issueUrl to FeedbackTriageJobData"
```

---

### Task 3: Add GitHub issue creation to feedback service

**Files:**
- Modify: `src/server/services/feedback.service.ts`

**Step 1: Add the `createGithubIssue` helper**

Add this private helper function inside the `feedbackService` object, before `postDiscordThread` (around line 279):

```ts
async createGithubIssue(
  feedbackId: string,
  data: {
    type: string;
    description: string;
    pageUrl: string;
    consoleLogs: { ts: number; level: string; msg: string }[];
  }
): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  if (!token || !repo) return null;

  const prefix = data.type === 'bug' ? '[Bug]' : data.type === 'feature' ? '[Feature]' : '[Feedback]';
  const title = `${prefix} ${data.description.slice(0, 72)}${data.description.length > 72 ? '...' : ''}`;

  const logLines = data.consoleLogs
    .slice(-5)
    .map((l) => `${l.level.toUpperCase()}: ${l.msg}`)
    .join('\n');

  const body = [
    `**Type:** ${data.type}`,
    `**Page:** ${data.pageUrl}`,
    `**Feedback ID:** ${feedbackId}`,
    '',
    '### Description',
    data.description,
    ...(logLines ? ['', '### Console Logs (last 5)', '```', logLines, '```'] : []),
  ].join('\n');

  const label =
    data.type === 'bug' ? 'bug' :
    data.type === 'feature' ? 'feature-request' :
    undefined;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: label ? [label] : [],
      }),
    });

    if (!res.ok) {
      console.error('[Feedback] GitHub issue creation failed:', await res.text());
      return null;
    }

    const issue = await res.json() as { html_url: string };
    return issue.html_url;
  } catch (err) {
    console.error('[Feedback] GitHub issue creation error:', err);
    return null;
  }
},
```

**Step 2: Call `createGithubIssue` at the top of `postDiscordThread`**

`postDiscordThread` starts at line 279. Its current signature is:
```ts
async postDiscordThread(
  feedback: { id: string; type: string; description: string },
  userDisplayName: string,
  data: { type: string; pageUrl: string; userAgent: string; screenshotBase64: string; consoleLogs: {...}[] }
)
```

At the very top of the function body (before the `botToken` / `channelId` check), add:
```ts
const issueUrl = await this.createGithubIssue(feedback.id, data);
```

**Step 3: Pass `issueUrl` to `addFeedbackTriageJob`**

Find the `addFeedbackTriageJob` call near the end of `postDiscordThread` (currently lines 381–388):
```ts
void addFeedbackTriageJob({
  feedbackId: feedback.id,
  threadId: thread.id,
  type: data.type,
  description: feedback.description,
  pageUrl: data.pageUrl,
  consoleLogs: data.consoleLogs,
});
```

Change to:
```ts
void addFeedbackTriageJob({
  feedbackId: feedback.id,
  threadId: thread.id,
  type: data.type,
  description: feedback.description,
  pageUrl: data.pageUrl,
  consoleLogs: data.consoleLogs,
  issueUrl: issueUrl ?? undefined,
});
```

**Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/server/services/feedback.service.ts
git commit -m "feat(feedback): create GitHub issue on feedback submission"
```

---

### Task 4: Add GitHub issue link to Discord triage embed

**Files:**
- Modify: `src/lib/queue/feedback-triage-worker.ts`

**Step 1: Update `postTriageEmbed` signature to accept `issueUrl`**

Current signature (line 98):
```ts
async function postTriageEmbed(threadId: string, triage: NonNullable<Awaited<ReturnType<typeof runClaudeTriage>>>) {
```

Change to:
```ts
async function postTriageEmbed(
  threadId: string,
  triage: NonNullable<Awaited<ReturnType<typeof runClaudeTriage>>>,
  issueUrl?: string
) {
```

**Step 2: Add issue link field to the embed**

Find the `fields` array in `postTriageEmbed` (lines ~117–124):
```ts
fields: [
  { name: 'Likely cause', value: triage.likely_cause ?? 'Unknown', inline: false },
  { name: 'Affected files', value: (triage.affected_files ?? []).join('\n') || 'Unknown', inline: true },
  { name: 'Suggested fix', value: triage.suggested_fix ?? 'See description', inline: false },
  ...(triage.reproduction_steps
    ? [{ name: 'Reproduction', value: triage.reproduction_steps, inline: false }]
    : []),
],
```

Change to:
```ts
fields: [
  { name: 'Likely cause', value: triage.likely_cause ?? 'Unknown', inline: false },
  { name: 'Affected files', value: (triage.affected_files ?? []).join('\n') || 'Unknown', inline: true },
  { name: 'Suggested fix', value: triage.suggested_fix ?? 'See description', inline: false },
  ...(triage.reproduction_steps
    ? [{ name: 'Reproduction', value: triage.reproduction_steps, inline: false }]
    : []),
  ...(issueUrl
    ? [{ name: 'GitHub Issue', value: `[View Issue](${issueUrl})`, inline: true }]
    : []),
],
```

**Step 3: Pass `issueUrl` at the call site**

Find the `postTriageEmbed` call in the worker processor (around line 143):
```ts
await postTriageEmbed(job.data.threadId, triage);
```

Change to:
```ts
await postTriageEmbed(job.data.threadId, triage, job.data.issueUrl);
```

**Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/lib/queue/feedback-triage-worker.ts
git commit -m "feat(feedback): add GitHub issue link to Discord triage embed"
```

---

### Task 5: Update PM2 worker and push

**Step 1: Restart PM2 worker to pick up env changes**

```bash
pm2 restart quiverdm-feedback-triage
pm2 save
```

**Step 2: Final lint + type check**

```bash
cd E:/Projects/QuiverDM
npm run lint
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Push**

```bash
git push origin main
```

**Step 4: Smoke test**

Submit feedback via the UI overlay. Verify:
1. GitHub issue appears in `DevVentari/quiverdm-feedback` with correct title, label, and body
2. Discord thread is created as before
3. Triage embed includes a `GitHub Issue` field with a working link

If `GITHUB_TOKEN` is not set in `.env`, issue creation silently skips — Discord and triage continue as normal.
