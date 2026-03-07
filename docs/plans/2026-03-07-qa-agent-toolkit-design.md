# QA Agent Toolkit Design

Date: 2026-03-07

## Problem

QuiverDM needs repeatable, automated QA that covers the two flagship features (homebrew library + transcription/recordings) and scales to future features. The current QA tests skip when prerequisite state doesn't exist, and there's no standard agent pattern for testing feature pipelines.

## Standard QA Agent Types

### 1. Smoke Agent
- **Purpose:** Fast pass over a feature area — page loads, no 500s, no console errors
- **Runtime:** < 30s per feature area
- **Pattern:** Sign in → navigate to each route → assert no errors → screenshot
- **When to use:** Every CI run, pre-deploy gate

### 2. Pipeline Agent
- **Purpose:** Test an async processing pipeline end-to-end (upload → process → verify output)
- **Runtime:** Up to 10 min (polling for completion)
- **Pattern:** Upload fixture → wait for processing → verify output state → verify output content
- **When to use:** After deploying workers, after changing processing logic
- **Key features:** Long-poll with timeout, periodic screenshots, detailed failure diagnostics

### 3. CRUD Agent
- **Purpose:** Test create/read/update/delete flows for a resource
- **Runtime:** < 2 min
- **Pattern:** Create resource → verify in list → open detail → edit → verify edit → delete → verify gone
- **When to use:** Any resource with full lifecycle (homebrew content, NPCs, sessions, campaigns)

### 4. Format Agent
- **Purpose:** Test that different input formats are handled correctly
- **Runtime:** Varies by format count
- **Pattern:** For each format: upload fixture → verify accepted → verify processing starts
- **When to use:** File upload features (PDFs, audio, video)

### 5. UI Review Agent
- **Purpose:** Visual regression and UX validation
- **Runtime:** < 1 min per page
- **Pattern:** Navigate to page → screenshot → check layout assertions (element positions, responsive)
- **When to use:** After UI changes, design system updates

### 6. Error Resilience Agent
- **Purpose:** Verify graceful degradation when things fail
- **Runtime:** < 2 min
- **Pattern:** Trigger error conditions → verify user-facing error messages → verify no crashes
- **When to use:** After adding error handling, API changes

## Test Fixture Strategy

```
tests/fixtures/
  clip-10s.mp3      # 80KB  - smoke tests
  clip-30s.mp3      # 236KB - basic transcription
  clip-60s.mp3      # 470KB - speaker diarization
  clip-5min.mp3     # 2.3MB - longer transcription
  clip-10s.mp4      # 252KB - video upload smoke
  clip-30s.mp4      # 1.1MB - video transcription
  clip-10s.wav      # 313KB - WAV format test
  clip-10s.webm     # 343KB - WebM format test
```

All fixtures derived from a real D&D session recording, ensuring realistic speech content for transcription validation.

## File Structure

```
tests/qa/
  homebrew-production.spec.ts     # Existing — fix serial dependency
  transcription-production.spec.ts # New — pipeline + format tests
  agents/                          # Shared agent utilities
    smoke.ts                       # Smoke agent helper
    pipeline.ts                    # Pipeline polling helper
    crud.ts                        # CRUD lifecycle helper
    format.ts                      # Multi-format upload helper
```

## Transcription QA Suite (New)

### Tests:
1. Sign in + navigate to session recordings
2. Upload audio file (clip-30s.mp3)
3. Verify recording appears in list
4. Verify transcription job starts
5. Poll until transcription completes (5min timeout)
6. Verify transcript text appears with content
7. Verify speaker labels present
8. Edit transcript segment
9. Rename speaker
10. Upload video file (clip-10s.mp4) — verify video→audio extraction
11. Upload WAV file — verify format accepted
12. Upload WebM file — verify format accepted
13. Delete recording
14. No 500 errors across recording pages
15. Console error audit

## Homebrew QA Fix

Restructure tests 7-13 as `test.describe.serial` with shared state from test 8's upload. Remove individual skip conditions — the serial block ensures state flows between tests.

## Implementation Priority

1. Fix Dockerfile (add FFmpeg) → rebuild worker container
2. Fix homebrew QA serial block
3. Build transcription QA suite
4. Extract shared agent utilities
