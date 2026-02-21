# Task: Error Consistency + Legacy Router Cleanup

## Working directory
E:/Projects/QuiverDM/.worktrees/wf-cleanup

## Goal
Two cleanup tasks:
1. Replace generic throw new Error() with typed errors in homebrew.ts and transcript.ts
2. Handle the unregistered whisper router in _app.ts

## Typed error pattern (already used in other routers)
Import pattern:
  import { NotFoundError, ForbiddenError } from '../errors';

Usage:
  throw new NotFoundError('transcript', id);           // uses new
  throw ForbiddenError.forPermission('edit', 'homebrew content');  // static factory, NO new

Check src/server/errors/ to confirm exact exports before using.

## Task 1: homebrew.ts router

File: src/server/routers/homebrew.ts

Find the removeImage procedure:
  if (content.userId !== ctx.session.user.id) {
    throw new Error('Forbidden');
  }

Replace with:
  if (content.userId !== ctx.session.user.id) {
    throw ForbiddenError.forPermission('edit', 'homebrew content');
  }

Add ForbiddenError to import if not already there.

## Task 2: transcript.ts router

File: src/server/routers/transcript.ts

Find the getTranscript procedure:
  if (!transcript) {
    throw new Error('Transcript not found');
  }

Replace with:
  if (!transcript) {
    throw new NotFoundError('transcript', input.transcriptId);
  }

Add NotFoundError to import if not already there.

## Task 3: Whisper router

1. Read src/server/routers/whisper.ts to understand what it does
2. Read src/server/routers/_app.ts to see current registrations

Decision:
- If whisper.ts exports a valid tRPC router with procedures, add it to _app.ts:
    import { whisperRouter } from './whisper';
    // and add whisper: whisperRouter, to appRouter
- If whisper.ts is empty, broken, or just stubs with no real functionality, DELETE the file
  (do not register broken code)

## Verification
Run: npx tsc --noEmit (must show 0 errors in src/ files)
Then: git add -A && git commit -m "fix: typed error consistency and register/remove whisper router"
