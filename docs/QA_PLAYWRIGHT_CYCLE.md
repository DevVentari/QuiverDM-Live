# Playwright QA Cycle

## Scope
- `tests/smoke/*`: fast gate for auth, campaign surfaces, NPC/homebrew access.
- `tests/workflows/*`: deeper deterministic flows for create/edit paths.
- Workflow specs include checkpoint attachments (timing + pass/fail per step).

## Scenario Set
1. `auth.smoke.spec.ts`
2. `auth-invalid.smoke.spec.ts`
3. `campaigns.smoke.spec.ts`
4. `homebrew-npcs.smoke.spec.ts`
5. `campaign-create.spec.ts`
6. `homebrew-pdf-upload-ui.spec.ts`
7. `npc-detail-required-sections.spec.ts`
8. `validation-edge.spec.ts`

## Team Split (Single Cycle)
1. Bug-hunt team runs smoke first, then workflows.
2. Fix team works only from failing test artifacts and issue list.
3. Bug-hunt team reruns only failed specs after each fix batch.
4. End cycle with full smoke + workflows pass.

## PowerShell Setup (Vercel URL)
```powershell
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $parts = $_ -split '=', 2
  $name = $parts[0].Trim()
  $value = $parts[1].Trim().Trim('"')
  Set-Item -Path "Env:$name" -Value $value
}
$env:BASE_URL = $env:QA_APP_URL
```

## Run Commands
```powershell
npm run test:playwright:smoke
npm run test:playwright:workflows
```

## Single-Command Cycle + Handoff Report
```powershell
npm run qa:cycle
```

Outputs:
- Summary JSON: `reports/playwright-cycle/<timestamp>.json`
- Raw Playwright JSON: `reports/playwright-cycle/<timestamp>/raw/*.json`
- Failure issue templates: `reports/playwright-cycle/<timestamp>/issues/*.md`
- Copied failure artifacts: `reports/playwright-cycle/<timestamp>/artifacts/*`

## Fast Iteration Commands
```powershell
# only rerun one failing spec
npx playwright test tests/workflows/campaign-create.spec.ts --reporter=list

# headed debug run for repro
npx playwright test tests/smoke/auth.smoke.spec.ts --headed --project=chromium --reporter=list
```
