# Agent Orchestration Runbook

## Objective

Run all engineering work through Codex agents with objective acceptance gates and workflow certification.

## Lifecycle

1. Create/update tasks from `docs/agents/task-queue.template.json`.
2. Assign each task to a single owning agent.
3. Execute work in the assigned agent branch/worktree.
4. Run gate checks:
   - `npm run agent:gate -- --task <TASK_ID> --agent <AGENT_ID>`
5. If gate passes, enqueue next dependent task.
6. After workflow-impacting tasks, run E2E capture:
   - `npm run workflow:e2e -- --workflow <workflow> --run-id <id> --command "<workflow command>"`
7. Generate certification:
   - `npm run workflow:certify`

## Parallel Execution Rules

Run tasks in parallel only when scopes do not overlap. If scopes overlap:

1. Pause lower-priority task.
2. Complete and gate higher-priority task.
3. Rebase/restart paused task.

## Mandatory Evidence

Every completed task must have:

1. Gate artifact in `docs/agents/results/*_gate.json`
2. Referenced command outputs in the artifact
3. E2E artifacts for affected workflow(s)

## Workflow Certification Policy

A workflow is certified only when:

1. At least 3 E2E runs have status `passed`
2. Certification summary says `certified: true`
3. Summary is present in workflow results directory

## Failure Handling

If a gate fails:

1. Keep the same task ID.
2. Attach failure artifact path to the task notes.
3. Re-run after fix; do not mark complete until gate passes.
