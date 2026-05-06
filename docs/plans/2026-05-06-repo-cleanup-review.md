# Repo Cleanup Review

Date: 2026-05-06
Scope: repository hygiene only
Constraint: no code changes, no deletions performed in this review

## Goal

Identify stale docs, generated artifacts, duplicate folders, and historical clutter that can be deleted, archived, or consolidated without touching active product code.

## Executive Summary

The main cleanup problem is not one bad folder. It is that the repo currently mixes:

- active product code
- generated local artifacts
- archived experiments
- multiple competing documentation systems
- side-project subtrees

The safest immediate cleanup is generated/local-only output. The highest-value structural cleanup is consolidating docs and moving large historical material out of the active workspace surface.

## Findings

### 1. Generated and local-only artifacts are still present in the working tree

These are already covered by `.gitignore`, which means the cleanup policy exists but the workspace is still carrying residue.

Relevant ignore rules:

- [.gitignore](/E:/Projects/QuiverDM/.gitignore:62)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:63)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:64)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:93)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:100)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:101)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:102)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:103)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:157)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:158)
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:159)

Observed examples:

- [playwright-report](/E:/Projects/QuiverDM/playwright-report)
- [test-results](/E:/Projects/QuiverDM/test-results)
- [reports](/E:/Projects/QuiverDM/reports)
- [logs](/E:/Projects/QuiverDM/logs)
- [temp](/E:/Projects/QuiverDM/temp)
- [dist](/E:/Projects/QuiverDM/dist)
- [graphify-out](/E:/Projects/QuiverDM/graphify-out)
- [src/graphify-out](/E:/Projects/QuiverDM/src/graphify-out)
- [.playwright-mcp](/E:/Projects/QuiverDM/.playwright-mcp)
- [.next](/E:/Projects/QuiverDM/.next)
- [.graphify_extract.json](/E:/Projects/QuiverDM/.graphify_extract.json)
- [test-output.log](/E:/Projects/QuiverDM/test-output.log)
- [vitest-results.json](/E:/Projects/QuiverDM/vitest-results.json)
- [vitest-results-2.json](/E:/Projects/QuiverDM/vitest-results-2.json)
- [wow-login-screens-2.png](/E:/Projects/QuiverDM/wow-login-screens-2.png)
- [wow-login-screens-3.png](/E:/Projects/QuiverDM/wow-login-screens-3.png)
- [wow-login-screens-wiki.png](/E:/Projects/QuiverDM/wow-login-screens-wiki.png)

Assessment:

- These are the lowest-risk cleanup targets.
- Most should be deleted locally and left ignored.

### 2. `.archive` is large tracked historical residue inside the main repo

Tracked file count snapshot:

- [.archive](/E:/Projects/QuiverDM/.archive) contains 400+ tracked entries in the sampled listing.

Contents include:

- archived docs
- old frontend code
- old tests
- old temp files
- old reports
- D&D Beyond import experiments

Assessment:

- This is useful history, but poor active-repo hygiene.
- Keeping it inside the main repo root makes discovery and maintenance noisier.

Recommendation:

- Move to a separate archival repo, or
- move under a clearly quarantined `archive/` strategy with documented retention rules.

### 3. Documentation is fragmented across too many parallel systems

Current doc surfaces include:

- [README.md](/E:/Projects/QuiverDM/README.md)
- [QUICK_START.md](/E:/Projects/QuiverDM/QUICK_START.md)
- [QuiverDM-Master-Document.md](/E:/Projects/QuiverDM/QuiverDM-Master-Document.md)
- [ADMIN_INVITES_GUIDE.md](/E:/Projects/QuiverDM/ADMIN_INVITES_GUIDE.md)
- [docs/plans](/E:/Projects/QuiverDM/docs/plans)
- [docs/superpowers](/E:/Projects/QuiverDM/docs/superpowers)
- [docs/Workflows](/E:/Projects/QuiverDM/docs/Workflows)
- [docs/agents](/E:/Projects/QuiverDM/docs/agents)
- [docs/obsidian-vault](/E:/Projects/QuiverDM/docs/obsidian-vault)
- [docs/RecapForge-PRD-Package](/E:/Projects/QuiverDM/docs/RecapForge-PRD-Package)

Assessment:

- This is not just “many docs”.
- It is multiple documentation systems with overlapping authority.

Important nuance:

- [docs/agents/README.md](/E:/Projects/QuiverDM/docs/agents/README.md:66) and [docs/Workflows/README.md](/E:/Projects/QuiverDM/docs/Workflows/README.md:82) suggest those two directories are still part of an active workflow/certification system.
- Those should not be deleted casually.

### 4. There are clearly historical or superseded docs still in the active docs surface

Examples:

- [docs/CODEX_HANDOFF.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF.md)
- [docs/CODEX_HANDOFF_2.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF_2.md)
- [docs/CODEX_HANDOFF_3.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF_3.md)
- large dated inventories in [docs/plans](/E:/Projects/QuiverDM/docs/plans)
- duplicate initiative tracks in [docs/superpowers](/E:/Projects/QuiverDM/docs/superpowers)

Assessment:

- These may be worth keeping as history.
- They should not remain mixed into the same surface as current docs unless they are still canonical.

### 5. `docs/` contains experiment/output content that does not read as durable documentation

Examples:

- [docs/campaign-site](/E:/Projects/QuiverDM/docs/campaign-site)
- [docs/Test](/E:/Projects/QuiverDM/docs/Test)
- [docs/transcription-tools](/E:/Projects/QuiverDM/docs/transcription-tools)
- [docs/hameria-ire-jsons](/E:/Projects/QuiverDM/docs/hameria-ire-jsons)
- [docs/Recordings](/E:/Projects/QuiverDM/docs/Recordings)

Assessment:

- These look like generated imports, one-off utilities, or side content.
- They should be moved to either:
  - an archive area
  - an untracked local workspace
  - a dedicated content repo

### 6. There appear to be duplicate browser extension paths

Observed:

- [extension](/E:/Projects/QuiverDM/extension)
- [browser-extension](/E:/Projects/QuiverDM/browser-extension)

Differences:

- `browser-extension` is a full package with its own `package.json`, `src`, `vite.config.ts`, ignored `dist`, and ignored `node_modules`
- `extension` is a flat manifest/background/popup structure

Assessment:

- Unless both are intentionally active, this is likely duplication.

Recommendation:

- Decide which extension path is canonical.
- Archive or remove the other.

### 7. Root-level one-off artifacts are polluting the top-level tree

Examples:

- [wow-login-screens-2.png](/E:/Projects/QuiverDM/wow-login-screens-2.png)
- [wow-login-screens-3.png](/E:/Projects/QuiverDM/wow-login-screens-3.png)
- [wow-login-screens-wiki.png](/E:/Projects/QuiverDM/wow-login-screens-wiki.png)
- [test-output.log](/E:/Projects/QuiverDM/test-output.log)
- [vitest-results.json](/E:/Projects/QuiverDM/vitest-results.json)
- [vitest-results-2.json](/E:/Projects/QuiverDM/vitest-results-2.json)
- [.graphify_extract.json](/E:/Projects/QuiverDM/.graphify_extract.json)

Assessment:

- Even when harmless, these reduce root scan quality.
- The root should contain durable project entrypoints, not scratch artifacts.

### 8. Some ignore policy should be normalized before broader cleanup

Example:

- [.gitignore](/E:/Projects/QuiverDM/.gitignore:109) ignores `CODEX_*.md`
- [.gitignore](/E:/Projects/QuiverDM/.gitignore:111) ignores `docs/codex-handoffs/`
- project instructions also tell agents to use `docs/codex-handoffs/`

Assessment:

- This is workable, but policy is mixed.
- Decide whether handoff docs are:
  - intentionally ephemeral and ignored
  - or intentionally tracked

## Recommended Cleanup Buckets

### Safe delete now

These are generated or local-only and should not be preserved in the active tree.

- [playwright-report](/E:/Projects/QuiverDM/playwright-report)
- [test-results](/E:/Projects/QuiverDM/test-results)
- [reports](/E:/Projects/QuiverDM/reports)
- [logs](/E:/Projects/QuiverDM/logs)
- [temp](/E:/Projects/QuiverDM/temp)
- [dist](/E:/Projects/QuiverDM/dist)
- [graphify-out](/E:/Projects/QuiverDM/graphify-out)
- [src/graphify-out](/E:/Projects/QuiverDM/src/graphify-out)
- [.playwright-mcp](/E:/Projects/QuiverDM/.playwright-mcp)
- [.next](/E:/Projects/QuiverDM/.next)
- [.graphify_extract.json](/E:/Projects/QuiverDM/.graphify_extract.json)
- [test-output.log](/E:/Projects/QuiverDM/test-output.log)
- [vitest-results.json](/E:/Projects/QuiverDM/vitest-results.json)
- [vitest-results-2.json](/E:/Projects/QuiverDM/vitest-results-2.json)
- [wow-login-screens-2.png](/E:/Projects/QuiverDM/wow-login-screens-2.png)
- [wow-login-screens-3.png](/E:/Projects/QuiverDM/wow-login-screens-3.png)
- [wow-login-screens-wiki.png](/E:/Projects/QuiverDM/wow-login-screens-wiki.png)

### Archive after review

These may still have value, but should be removed from the active workspace surface.

- [.archive](/E:/Projects/QuiverDM/.archive)
- [docs/CODEX_HANDOFF.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF.md)
- [docs/CODEX_HANDOFF_2.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF_2.md)
- [docs/CODEX_HANDOFF_3.md](/E:/Projects/QuiverDM/docs/CODEX_HANDOFF_3.md)
- most of [docs/plans](/E:/Projects/QuiverDM/docs/plans) once distilled
- most of [docs/superpowers](/E:/Projects/QuiverDM/docs/superpowers) once distilled
- [docs/RecapForge-PRD-Package](/E:/Projects/QuiverDM/docs/RecapForge-PRD-Package)
- [docs/campaign-site](/E:/Projects/QuiverDM/docs/campaign-site)
- [docs/Test](/E:/Projects/QuiverDM/docs/Test)
- [docs/transcription-tools](/E:/Projects/QuiverDM/docs/transcription-tools)
- [docs/hameria-ire-jsons](/E:/Projects/QuiverDM/docs/hameria-ire-jsons)
- [docs/Recordings](/E:/Projects/QuiverDM/docs/Recordings)

### Keep as canonical unless intentionally retired

These currently look like living sources of truth or active infrastructure docs.

- [README.md](/E:/Projects/QuiverDM/README.md)
- [AGENTS.md](/E:/Projects/QuiverDM/AGENTS.md)
- [docs/agents](/E:/Projects/QuiverDM/docs/agents)
- [docs/Workflows](/E:/Projects/QuiverDM/docs/Workflows)
- selected items from [docs/design-system](/E:/Projects/QuiverDM/docs/design-system)
- [docs/obsidian-vault/KANBAN.md](/E:/Projects/QuiverDM/docs/obsidian-vault/KANBAN.md) if it is still the operational board

### Needs ownership decision first

- [extension](/E:/Projects/QuiverDM/extension)
- [browser-extension](/E:/Projects/QuiverDM/browser-extension)
- [foundry-module](/E:/Projects/QuiverDM/foundry-module)
- [evals](/E:/Projects/QuiverDM/evals)

## Proposed Target Structure

Recommended documentation model:

### Root

Keep only:

- `README.md`
- `AGENTS.md`
- minimal setup/operator docs if still necessary

### `docs/product/`

Keep:

- current PRD
- current roadmap
- current design system

### `docs/engineering/`

Keep:

- deployment
- workflows
- agent orchestration
- architecture docs

### `docs/archive/`

Move:

- superseded plans
- superseded specs
- historical handoffs
- old initiative bundles

### `docs/research/`

Keep only curated research worth retaining

### untracked local or generated area

Move or leave ignored:

- screenshots
- results
- graph exports
- imported JSON dumps
- recordings

## Recommended Execution Order

1. Delete all generated/local-only artifacts.
2. Remove root junk files.
3. Decide the canonical browser extension path.
4. Distill active docs from `docs/plans` and `docs/superpowers`.
5. Move historical doc material into an archive strategy.
6. Normalize `.gitignore` and documentation ownership rules.

## Suggested Next Step

The best next pass is not deletion yet. It is a concrete path classification list:

- `delete now`
- `archive`
- `keep`
- `needs owner decision`

That list should be reviewed once before any destructive cleanup.
