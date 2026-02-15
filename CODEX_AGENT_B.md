# Codex Agent B — Feature Completion & Testing

> **Branch**: `codex/feature-completion`
> **Worktree**: `.worktrees/codex-agent-b/`
> **Scope**: Backend endpoints, API fixes, test setup, E2E flows
> **DO NOT touch**: `src/components/ui/`, `src/components/sidebar.tsx`, `next.config.js`, `src/app/(marketing)/`

---

## Tasks

### Task 1: Session Recap Generation Endpoint (Priority: Critical)

The UI has "Coming soon" buttons for generating recaps from transcripts. Build the backend endpoint.

**What to do:**

1. **Check if Session model has a recap field** — read `prisma/schema.prisma`, look for the `GameSession` model. If `recap` field doesn't exist, add it:
   ```prisma
   recap String? @db.Text
   ```
   Then run `npx prisma db push` (but since Codex can't run commands, just add the field and note it needs `db:push`).

2. **Add service method** in `src/server/services/session.service.ts`:
   ```typescript
   async generateRecap(sessionId: string, userId: string): Promise<string> {
     // 1. Verify user is DM of the session's campaign
     // 2. Fetch all transcripts for the session via prisma
     // 3. Concatenate transcript text (correctedText or rawText)
     // 4. If no transcript text, throw BadRequestError
     // 5. Call AI to summarize (use the pattern from src/lib/ai/)
     // 6. Save recap to session
     // 7. Return the recap text
   }
   ```

   For the AI call, use a simple approach:
   ```typescript
   import { generateText } from '@/lib/ai/ollama';

   const prompt = `You are a D&D session recap writer. Summarize this session transcript into a narrative recap suitable for players. Include key events, NPC interactions, combat outcomes, and important decisions. Keep it concise (2-4 paragraphs).\n\nTranscript:\n${transcriptText}`;

   const recap = await generateText(prompt);
   ```

   Check what functions `src/lib/ai/ollama.ts` exports and use the appropriate one. If there's no simple `generateText`, look at how extraction works in `src/lib/ai/extraction.ts` and follow that pattern.

3. **Add tRPC endpoint** in `src/server/routers/sessions.ts`:
   ```typescript
   generateRecap: campaignDMProcedure
     .input(z.object({
       campaignId: z.string(),
       sessionId: z.string(),
     }))
     .mutation(async ({ input, ctx }) => {
       const recap = await sessionService.generateRecap(input.sessionId, ctx.session.user.id);
       return { recap };
     }),
   ```

4. **Enable the UI buttons** in `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`:
   - Find the "Coming soon" badges and disabled buttons for recap generation
   - Remove the disabled state and "Coming soon" badges
   - Wire the button to call `trpc.sessions.generateRecap.useMutation()`
   - Show loading spinner during generation
   - Display the generated recap

**Reference files:**
- `src/server/services/session.service.ts` — add generateRecap method
- `src/server/routers/sessions.ts` — add endpoint
- `src/lib/ai/ollama.ts` — AI text generation
- `src/lib/ai/extraction.ts` — see how AI is called
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — enable UI

### Task 2: Fix NPC Image Upload Auth (Priority: High)

**File**: `src/app/api/upload/npc-image/route.ts`

Read this file. If it uses a hardcoded `'temp-user'` or missing auth, fix it:

```typescript
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  // ... use userId instead of 'temp-user'
}
```

### Task 3: Set Up Vitest (Priority: Medium)

No test framework is configured. Set up Vitest for unit/integration testing.

**What to do:**

1. **Create `vitest.config.ts`** at project root:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import path from 'path';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       include: ['tests/**/*.test.ts'],
       setupFiles: ['tests/setup.ts'],
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, 'src'),
       },
     },
   });
   ```

2. **Create `tests/setup.ts`**:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config({ path: '.env' });
   ```

3. **Add to `package.json` scripts**:
   ```json
   "test": "vitest run",
   "test:watch": "vitest"
   ```

4. **Add to `package.json` devDependencies**: `vitest` (note: Codex should add it to the deps list, actual install happens separately)

5. **Create sample tests** to verify the setup works:

   **`tests/services/usage.test.ts`** — test tier limits:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { TIER_LIMITS } from '@/server/services/usage.service';

   describe('TIER_LIMITS', () => {
     it('free tier has correct limits', () => {
       expect(TIER_LIMITS.free.campaigns).toBe(1);
       expect(TIER_LIMITS.free.transcriptionSeconds).toBe(1800);
       expect(TIER_LIMITS.free.pdfUploads).toBe(5);
     });

     it('pro tier has unlimited campaigns', () => {
       expect(TIER_LIMITS.pro.campaigns).toBe(-1);
     });

     it('team tier has highest limits', () => {
       expect(TIER_LIMITS.team.transcriptionSeconds).toBeGreaterThan(TIER_LIMITS.pro.transcriptionSeconds);
       expect(TIER_LIMITS.team.pdfUploads).toBeGreaterThan(TIER_LIMITS.pro.pdfUploads);
     });
   });
   ```

   **`tests/lib/email.test.ts`** — test email service graceful degradation:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { emailService } from '@/lib/email';

   describe('emailService', () => {
     it('returns not sent when not configured', async () => {
       const result = await emailService.sendWelcomeEmail({ to: 'test@example.com' });
       expect(result.sent).toBe(false);
       expect(result.error).toContain('not configured');
     });
   });
   ```

### Task 4: Clean Up Dead Router References (Priority: Low)

Read `src/server/routers/_app.ts` and remove any commented-out or unused router imports/registrations. Also check for any `.ts` files in `src/server/routers/` that aren't registered in `_app.ts`.

---

## Key Patterns

**tRPC router pattern:**
```typescript
import { z } from 'zod';
import { router, campaignDMProcedure } from '../trpc';

export const myRouter = router({
  myEndpoint: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.session.user.id, ctx.membership
    }),
});
```

**Error classes** — NO `new` on static factories:
```typescript
throw new NotFoundError('session', id);
throw new BadRequestError('No transcript text available');
throw ForbiddenError.forPermission('generate', 'recap');  // NO new
```

**Campaign-scoped procedures:**
- `campaignMemberProcedure` — any campaign member
- `campaignDMProcedure` — OWNER or CO_DM only
- `campaignOwnerProcedure` — OWNER only

All require `campaignId` in input and add `ctx.membership`.

---

## Schema Changes

If you modify `prisma/schema.prisma`, add a note at the top of your commit message:
```
NOTE: Run `npx prisma db push` after merging to apply schema changes.
```

---

## Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint        # pass
```

Commit all changes on `codex/feature-completion` branch with descriptive messages.
