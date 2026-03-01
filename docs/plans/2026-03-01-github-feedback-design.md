# GitHub Feedback Issues — Design

**Goal:** When feedback is submitted, create a GitHub issue in a private repo and include the issue link in the Discord triage embed.

**Architecture:** `feedbackService.createReport` calls `createGithubIssue()` before enqueueing the triage job, passing `issueUrl` through the BullMQ payload. The worker includes a GitHub issue link field in the Discord embed. One-time setup script creates the private repo and labels.

**Tech Stack:** GitHub REST API (via fetch), BullMQ, Discord API, Next.js API route

---

## Flow

1. User submits feedback via UI
2. `feedbackService.createReport` creates GitHub issue → gets `issueUrl`
3. Enqueues `FeedbackTriageJobData` (with `issueUrl`) to BullMQ
4. Discord thread created (as today)
5. Worker picks up job → runs Claude triage → posts embed to Discord thread with added "GitHub Issue" link field

## GitHub Repo

- Repo: `DevVentari/quiverdm-feedback` (private)
- Created via `gh repo create DevVentari/quiverdm-feedback --private`
- Labels: `bug`, `feature-request` (auto-created by setup script)
- Auth: `GITHUB_TOKEN` env var (fine-grained PAT with `issues: write`, or `gh auth token` value)

## Issue Format

**Title:** `[Bug] Page description` or `[Feature] description` — derived from `data.type` + `data.description` (truncated to 80 chars)

**Body:**
```
**Type:** bug | feature | other
**Page:** https://...
**Description:** ...

### Console Logs (last 5)
```
ERROR: ...
```
```

**Labels:** `bug` for type=bug, `feature-request` for type=feature, none otherwise

## Data Flow Changes

`FeedbackTriageJobData` gains optional `issueUrl?: string`. The worker's Discord embed gains a new field:
```
{ name: 'GitHub Issue', value: '[#123](https://github.com/...)', inline: true }
```

If `GITHUB_TOKEN` is not set, issue creation is skipped silently (no breakage).

## Files

| Action | File |
|--------|------|
| Create | `scripts/setup-github-feedback-repo.sh` |
| Modify | `src/server/services/feedback.service.ts` |
| Modify | `src/lib/queue/feedback-triage-queue.ts` |
| Modify | `src/lib/queue/feedback-triage-worker.ts` |
| Env | `GITHUB_TOKEN`, `GITHUB_FEEDBACK_REPO=DevVentari/quiverdm-feedback` |
