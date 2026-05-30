# Playwright QA Script Plan

## Goal
Build a reliable, fast QA suite that catches UI and workflow regressions before release to Vercel production.

## Current Baseline (Already Implemented)
- Smoke:
  - `tests/smoke/auth.smoke.spec.ts`
  - `tests/smoke/auth-invalid.smoke.spec.ts`
  - `tests/smoke/campaigns.smoke.spec.ts`
  - `tests/smoke/homebrew-npcs.smoke.spec.ts`
- Workflows:
  - `tests/workflows/campaign-create.spec.ts`
  - `tests/workflows/homebrew-pdf-upload-ui.spec.ts`
  - `tests/workflows/npc-detail-required-sections.spec.ts`
  - `tests/workflows/validation-edge.spec.ts`
- Runner:
  - `npm run qa:cycle` (`scripts/qa-playwright-cycle.ts`)

## Scripts To Build Next (Priority Order)

### P0: Release Gate (must pass every deploy)
1. `tests/smoke/navigation-core.smoke.spec.ts`
- Validate top-nav routes for key app sections return expected headings.
2. `tests/smoke/session-core.smoke.spec.ts`
- Open session list and a known session detail page; verify core controls render.
3. `tests/smoke/homebrew-pdf-list.smoke.spec.ts`
- Validate PDFs table/list renders and empty/loading/error states are handled.
4. `tests/smoke/access-control.smoke.spec.ts`
- Confirm protected routes redirect to sign-in when logged out.

### P1: Critical Business Workflows
1. `tests/workflows/campaign-edit.spec.ts`
- Edit campaign fields and verify persistence after reload.
2. `tests/workflows/npc-edit.spec.ts`
- Edit NPC identity/stat block fields and verify saved detail state.
3. `tests/workflows/session-create-and-prep.spec.ts`
- Create session from campaign, open prep page, verify key prep panels.
4. `tests/workflows/member-invite.spec.ts`
- Invite flow UI checks; verify pending invite appears.
5. `tests/workflows/homebrew-create-manual.spec.ts`
- Create non-PDF homebrew entry and verify detail render.

### P2: Data Integrity + Edge Cases
1. `tests/workflows/form-limits.spec.ts`
- Max-length/name validation and boundary checks on campaign/NPC/homebrew forms.
2. `tests/workflows/duplicate-name-handling.spec.ts`
- Behavior when creating entities with duplicate names.
3. `tests/workflows/network-failure-recovery.spec.ts`
- Intercept API failures and assert user-facing error handling.
4. `tests/workflows/cancel-and-back-navigation.spec.ts`
- Ensure cancel/back does not create partial entities.

### P3: Cross-Cutting Confidence
1. `tests/regression/mobile-layout.spec.ts`
- Run on iPhone viewport for critical pages and actions.
2. `tests/regression/console-errors.spec.ts`
- Fail test if console has uncaught errors on critical routes.
3. `tests/regression/performance-budget.spec.ts`
- Step budgets for page-ready checkpoints on core flows.
4. `tests/regression/visual-core.spec.ts`
- Snapshot checks for key pages/components with stable fixtures.

## Suggested Project Structure
- `tests/smoke/` fast release gates (2-5 min total target)
- `tests/workflows/` critical end-to-end user value flows
- `tests/regression/` broader confidence checks (can run nightly)
- `tests/personas/` behavior suites by user archetype (new/veteran/power/player/mobile/resilience)
- `tests/helpers/` shared auth, checkpoint, fixtures, seeded IDs

## Run Cadence
1. PR checks: smoke only
2. Merge-to-main: smoke + workflows
3. Nightly: smoke + workflows + regression
4. Pre-release tag: full suite + headed replay of recent failures

## Team Split (Bug Hunt vs Fix)
1. Bug-hunt team runs `npm run qa:cycle` and raises issues from generated artifacts.
2. Fix team takes issue templates and resolves in small batches.
3. Bug-hunt team reruns only failed specs, then full cycle.

## Standard Commands
```powershell
# full gate
npm run qa:cycle

# smoke only
npm run test:playwright:smoke

# workflows only
npm run test:playwright:workflows

# single failing spec rerun
npx playwright test tests/workflows/<spec>.spec.ts --reporter=list
```

## Definition of Done for “Solid QA”
1. P0 and P1 suites exist and are stable for 7 consecutive days.
2. All critical workflows have at least one happy path and one failure-path test.
3. Every failing CI run produces reproducible artifacts and issue template output.
4. Median `qa:cycle` runtime stays below 10 minutes.
