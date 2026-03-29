# Codex Agent Orchestration

This folder defines the machine-readable contract for agent-only delivery:

- Task specification schema
- Agent run result schema
- Workflow E2E run schema
- Gate artifacts and workflow certification outputs

## Core Rules

1. Agent work is accepted only when objective checks pass.
2. Handoff to the next task happens only after gate pass.
3. Every workflow requires at least 3 successful E2E runs for certification.

## Schemas

- `docs/agents/schemas/agent-task-spec.schema.json`
- `docs/agents/schemas/agent-run-result.schema.json`
- `docs/agents/schemas/workflow-e2e-run.schema.json`

## Commands

Run gate checks for one task:

```bash
npx tsx scripts/agent-gate.ts --task TASK-001 --agent AGENT_B
```

Add task-specific checks:

```bash
npx tsx scripts/agent-gate.ts --task TASK-001 --agent AGENT_B --check "npm run test:quick"
```

Run one E2E workflow attempt and write evidence:

```bash
npx tsx scripts/run-workflow-e2e.ts --workflow pdf-processing --run-id pdf-001 --command "npm run test:e2e"
```

For workflows without a configured `recommendedCommand`, `--command` is required.

Certify all workflows (requires at least 3 successful runs each):

```bash
npx tsx scripts/certify-workflows.ts
```

Frontend lane (Playwright):

```bash
# Run one frontend workflow attempt
npm run workflow:e2e:frontend -- --workflow campaign-management-ui --run-id ui-campaign-001

# Certify frontend workflows
npm run workflow:certify:frontend
```

Certify one workflow:

```bash
npx tsx scripts/certify-workflows.ts --workflow pdf-processing
```

## Artifacts

- Agent gates: `docs/agents/results/*_gate.json`
- Workflow runs: `docs/Workflows/<workflow>/results/*.json|*.md|*.log`
- Workflow certification: `docs/Workflows/<workflow>/results/certification-summary.json`

## Workflow Registry

`config/agent-workflows.json` contains:

- workflow IDs
- recommended command per workflow
- result directory
- minimum successful run count (global)
