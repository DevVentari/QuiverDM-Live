# QuiverDM Backend Workflow Testing

This directory contains test documentation and results for all backend workflows.

## Directory Structure

```
Workflows/
├── README.md                    # This file
├── campaign-management/         # Campaign CRUD and member management
├── session-management/          # Session and recording workflows
├── transcription-pipeline/      # Audio/video transcription with WhisperX
├── pdf-processing/              # PDF upload, Marker conversion, AI extraction
├── homebrew-content/            # Homebrew creation, D&D Beyond integration
└── character-management/        # Character CRUD and campaign assignment
```

## Workflow Status

| Workflow | Status | Last Tested | Certification (3 runs) | Notes |
|----------|--------|-------------|-------------------------|-------|
| Campaign Management | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Agent-run workflow checks |
| Session Management | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Agent-run workflow checks |
| Transcription Pipeline | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Agent-run workflow checks |
| PDF Processing | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Queue/worker active; evidence in results/ |
| Homebrew Content | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Agent-run workflow checks |
| Character Management | ✅ Passing | 2026-02-16 | ✅ Certified (3/3) | Agent-run workflow checks |

## Running Tests

### Prerequisites
```bash
# Ensure services are running
docker-compose up -d

# Start dev server
npm run dev

# For PDF processing
npm run worker:pdf
```

### Test Commands
```bash
# Quick transcription test
npm run test:quick

# Full transcription test
npm run test:transcribe

# Lint check
npm run lint

# Agent gate for a completed task
npm run agent:gate -- --task TASK-001 --agent AGENT_B

# Record one workflow E2E run
npm run workflow:e2e -- --workflow pdf-processing --run-id pdf-001 --command "npm run test:e2e"

# Check certification status (requires 3 successful runs per workflow)
npm run workflow:certify
```

## Test Result Format

Each workflow directory contains:
- `README.md` - Workflow overview and test procedures
- `docs/` - Additional documentation, schemas, examples
- `results/` - Test execution results with timestamps

Results files should follow the naming convention:
`YYYY-MM-DD_HH-MM_test-name.md`

## Version Control

All test documentation is version controlled. When updating:
1. Update the workflow README with new test procedures
2. Add test results to the `results/` directory
3. Update the status table in this file
4. Commit with message: `test(workflow-name): description`

## Agent Certification Policy

The project uses an objective certification gate for agent-only execution:

1. A task is accepted only when `agent:gate` checks pass.
2. Each workflow needs at least **3 successful E2E runs**.
3. Certification output is stored in:
   - `docs/Workflows/<workflow>/results/certification-summary.json`
   - `docs/Workflows/<workflow>/results/certification-summary.md`
