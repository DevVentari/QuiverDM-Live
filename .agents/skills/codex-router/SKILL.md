---
name: codex-router
description: Use when deciding whether to delegate implementation to Codex or handle directly. Applies to any task that could be split between Codex (architect/reviewer) and Codex (pattern-following implementer).
---

# Codex Router — Delegation Decision Framework

## Decision Table

### → Delegate to Codex

Pattern-following work with isolated scope:

| Task Type | Examples |
|-----------|----------|
| New components/pages | Following existing layout patterns, shadcn/ui components |
| New test files | E2E specs (Playwright), unit tests (Vitest) |
| New workers/repos/routers | Using `quiverdm-worker`, `quiverdm-repository`, `trpc-architect` skills |
| Simple bug fixes | Off-by-one, typos, missing null checks, wrong prop names |
| DB migrations | New Prisma models, adding fields, indexes |
| Docs & research | Summarize APIs, write handoff docs, research libraries |
| Styling & layout | CSS/Tailwind changes, responsive fixes, icon swaps |
| Refactors with clear scope | Rename a variable across files, extract a component |

### → Keep in Codex

Reasoning-heavy, judgment-required, or cross-cutting:

| Task Type | Examples |
|-----------|----------|
| Architecture decisions | New service boundaries, data flow design, API shape |
| Security-sensitive code | Auth, billing, webhooks, session tokens, RBAC |
| Cross-cutting changes | 5+ interdependent files, shared type changes |
| Complex debugging | Multi-layer bugs, race conditions, state issues |
| Code review | Reviewing Codex output, merge conflict resolution |
| Planning & scoping | Breaking features into tasks, estimating complexity |
| Performance optimization | Profiling, query optimization, caching strategy |

## Launch Template

When delegating to Codex, use this pattern:

1. **Create handoff doc** — Write a `CODEX_AGENT_<name>.md` with:
   - Goal (1 sentence)
   - Files to create/modify (explicit paths)
   - Patterns to follow (reference skill names or example files)
   - Acceptance criteria (what "done" looks like)
   - Constraints (don't touch X, use Y not Z)

2. **Create worktree** (if parallel work):
   ```bash
   git worktree add .Codex/worktrees/<name> -b codex/<name>
   ```

3. **Launch Codex**:
   ```bash
   codex exec --full-auto -C "<worktree-dir>" "Read CODEX_AGENT_<name>.md and implement all tasks described."
   ```
   Use `run_in_background: true` for all Codex launches.

## Parallel Agent Rules

- **Max 5 concurrent agents** — beyond this, merge conflicts and context switching outweigh gains
- **Each agent gets its own worktree** — never share a worktree between agents
- **Independent scope only** — if Agent B needs Agent A's output, run them sequentially
- **Name worktrees clearly** — `codex/feature-auth`, `codex/test-billing`, etc.

## Post-Codex Review Checklist

After every Codex agent completes, Codex MUST:

1. **`git diff`** — Review all changes for correctness and security
2. **`npx tsc --noEmit`** — Zero type errors
3. **`npx eslint src/`** — No new lint errors (warnings OK)
4. **Merge or fix** — If clean, merge to working branch. If issues, fix directly or re-delegate.

Never blindly merge Codex output. Codex is the architect and reviewer — Codex is the implementer.
