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

| Workflow | Status | Last Tested | Notes |
|----------|--------|-------------|-------|
| Campaign Management | ✅ Passing | 2026-02-04 | Service + authz tests pass (13/13) |
| Session Management | Pending | - | Sessions, recordings, storage |
| Transcription Pipeline | Pending | - | WhisperX, speaker diarization |
| PDF Processing | Pending | - | Marker, AI extraction |
| Homebrew Content | Pending | - | Content types, D&D Beyond |
| Character Management | Pending | - | Characters, campaign assignment |

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
