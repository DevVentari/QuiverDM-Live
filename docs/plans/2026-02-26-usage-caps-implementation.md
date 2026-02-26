# Usage Caps & Cost Guardrails — Implementation Plan

**Date:** 2026-02-26
**Design doc:** `docs/plans/2026-02-26-usage-caps-design.md`

---

## Task 1: Wire PDF upload cap into homebrew-pdf router

**File:** `src/server/routers/homebrew-pdf.ts`

Add `usageService` import at top:
```ts
import { usageService } from '../services/usage.service';
```

Change `createPDF` procedure from the thin `.mutation(({ input, ctx }) => ...)` arrow to an `async` block:
```ts
createPDF: protectedProcedure
  .input(
    z.object({
      filename: z.string(),
      fileSize: z.number(),
      mimeType: z.string().default('application/pdf'),
      r2Url: z.string(),
      r2Key: z.string(),
      campaignId: z.string().optional(),
      useLLM: z.boolean().default(false),
      llmProvider: z.enum(['gemini', 'anthropic', 'openai']).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    await usageService.incrementPdfUploads(ctx.session.user.id);
    return homebrewPdfService.createPDF(ctx.session.user.id, input);
  }),
```

`incrementPdfUploads` already calls `canUploadPdf` and throws `RateLimitedError` if over limit.

**Verify:** `npx tsc --noEmit 2>&1 | head -20` → 0 errors.

**Commit:** `fix: enforce PDF upload cap in homebrewPdf.createPDF`

---

## Task 2: Wire session upload cap into session-recordings router

**File:** `src/server/routers/session-recordings.ts`

Add `usageService` import at top:
```ts
import { usageService } from '../services/usage.service';
```

In the `create` procedure (line 23), add `incrementSessionUploads` call after the auth check and before the DB create:
```ts
.mutation(async ({ input, ctx }) => {
  const userId = ctx.session.user.id;
  await authz.session(input.sessionId, userId).verify();
  await usageService.incrementSessionUploads(userId);  // ← ADD THIS LINE
  const recording = await prisma.sessionRecording.create({
    // ... existing code
  });
  return recording;
}),
```

**Verify:** `npx tsc --noEmit 2>&1 | head -20` → 0 errors.

**Commit:** `fix: enforce session upload cap in sessionRecordings.create`

---

## Task 3: Wire transcription cap into session-transcription router

**File:** `src/server/routers/session-transcription.ts`

Add `usageService` import at top (after existing imports):
```ts
import { usageService } from '../services/usage.service';
```

After line 224 (`await tracker.complete(transcriptId);`) and before the `return { success: true, ... }` block, add:
```ts
// Track transcription usage (fire-and-forget — don't block return)
if (result.duration) {
  void usageService.incrementTranscription(userId, result.duration).catch(() => {});
}
```

Use fire-and-forget because transcription is already complete — we don't want a usage accounting error to surface as a transcription failure.

**Verify:** `npx tsc --noEmit 2>&1 | head -20` → 0 errors.

**Commit:** `fix: track transcription seconds usage after successful transcription`

---

## Task 4: Add threshold alert helper to usage service + email service

### Step 1: Add `sendUsageAlert` to email service

**File:** `src/lib/email.ts`

Add a new method to `EmailService` class before the closing `}`:
```ts
async sendUsageAlert(params: {
  userId: string;
  tier: string;
  limitFamily: string;
  used: number;
  limit: number;
  percentage: number;
  periodEnd: Date;
}): Promise<void> {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean);
  if (!adminEmails?.length) return;

  const subject = `[QuiverDM] Usage alert: ${params.limitFamily} at ${Math.round(params.percentage)}%`;
  const html = `
    <p><strong>Usage threshold alert</strong></p>
    <ul>
      <li>User: ${params.userId}</li>
      <li>Tier: ${params.tier}</li>
      <li>Limit: ${params.limitFamily}</li>
      <li>Used: ${params.used} / ${params.limit} (${Math.round(params.percentage)}%)</li>
      <li>Period ends: ${params.periodEnd.toISOString()}</li>
    </ul>
  `;

  for (const email of adminEmails) {
    await this.send({ to: email, subject, html }).catch(() => {});
  }
}
```

### Step 2: Add `checkAndAlertThreshold` to usage service

**File:** `src/server/services/usage.service.ts`

Add import at top:
```ts
import { emailService } from '@/lib/email';
```

Add a private helper method at the bottom of the `usageService` object, before the closing `}`:
```ts
async checkAndAlertThreshold(
  userId: string,
  tier: string,
  limitFamily: string,
  used: number,
  limit: number,
  periodEnd: Date
): Promise<void> {
  if (limit === -1) return; // unlimited
  const percentage = (used / limit) * 100;
  if (percentage < 80) return; // only alert at 80%+

  // Fire-and-forget
  emailService.sendUsageAlert({ userId, tier, limitFamily, used, limit, percentage, periodEnd }).catch(() => {});
},
```

### Step 3: Call `checkAndAlertThreshold` from each increment method

In each `increment*` method, after the `prisma.userUsage.update(...)` call, add a fire-and-forget threshold check. Example for `incrementPdfUploads`:

```ts
async incrementPdfUploads(userId: string) {
  const canUpload = await this.canUploadPdf(userId);
  if (!canUpload) {
    throw new RateLimitedError('PDF upload limit reached for your tier. Upgrade to Pro for more uploads.');
  }
  const updated = await prisma.userUsage.update({
    where: { userId },
    data: { pdfUploads: { increment: 1 } },
  });

  // Fire-and-forget threshold alert
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
  if (user) {
    void this.checkAndAlertThreshold(
      userId, user.tier ?? 'free', 'pdfUploads',
      updated.pdfUploads, updated.pdfUploadLimit, updated.periodEnd
    );
  }
  return updated;
},
```

Apply the same pattern to: `incrementTranscription`, `incrementSessionUploads`, `incrementAiRecaps`, `incrementSemanticSearches`, `incrementImageGenerations`.

**Verify:** `npx tsc --noEmit 2>&1 | head -20` → 0 errors.

**Commit:** `feat: add 80% usage threshold alert emails to admin`

---

## Task 5: Add 4 missing usage meters to settings page

**File:** `src/app/(app)/settings/page.tsx`

The settings page already has meters for campaigns, transcription, and PDF uploads (lines 406-488). Add 4 more meters inside the same `grid` div (`<div className="grid grid-cols-1 md:grid-cols-3 gap-4">`), after the existing PDF Uploads meter:

```tsx
{/* Session Uploads Meter */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-2">
    <Upload className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium">Session Uploads</span>
  </div>
  {usage.data.sessionUploads.limit === -1 ? (
    <>
      <Progress value={0} className="h-2" aria-label="Session upload usage" />
      <p className="text-sm text-muted-foreground">
        {usage.data.sessionUploads.used} used — Unlimited
      </p>
    </>
  ) : (
    <>
      <Progress
        value={Math.min(usage.data.sessionUploads.percentage, 100)}
        className="h-2"
        indicatorClassName={getProgressColor(usage.data.sessionUploads.percentage)}
        aria-label="Session upload usage"
      />
      <p className={`text-sm ${getTextColor(usage.data.sessionUploads.percentage)}`}>
        {usage.data.sessionUploads.used} of {usage.data.sessionUploads.limit} used
      </p>
    </>
  )}
</div>

{/* AI Recaps Meter */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-2">
    <Sparkles className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium">AI Recaps</span>
  </div>
  {usage.data.aiRecaps.limit === -1 ? (
    <>
      <Progress value={0} className="h-2" aria-label="AI recap usage" />
      <p className="text-sm text-muted-foreground">
        {usage.data.aiRecaps.used} used — Unlimited
      </p>
    </>
  ) : (
    <>
      <Progress
        value={Math.min(usage.data.aiRecaps.percentage, 100)}
        className="h-2"
        indicatorClassName={getProgressColor(usage.data.aiRecaps.percentage)}
        aria-label="AI recap usage"
      />
      <p className={`text-sm ${getTextColor(usage.data.aiRecaps.percentage)}`}>
        {usage.data.aiRecaps.used} of {usage.data.aiRecaps.limit} used
      </p>
    </>
  )}
</div>

{/* Semantic Searches Meter */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-2">
    <Search className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium">Semantic Searches</span>
  </div>
  {usage.data.semanticSearches.limit === -1 ? (
    <>
      <Progress value={0} className="h-2" aria-label="Semantic search usage" />
      <p className="text-sm text-muted-foreground">
        {usage.data.semanticSearches.used} used — Unlimited
      </p>
    </>
  ) : (
    <>
      <Progress
        value={Math.min(usage.data.semanticSearches.percentage, 100)}
        className="h-2"
        indicatorClassName={getProgressColor(usage.data.semanticSearches.percentage)}
        aria-label="Semantic search usage"
      />
      <p className={`text-sm ${getTextColor(usage.data.semanticSearches.percentage)}`}>
        {usage.data.semanticSearches.used} of {usage.data.semanticSearches.limit} used
      </p>
    </>
  )}
</div>

{/* Image Generations Meter */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-2">
    <Image className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium">Image Generations</span>
  </div>
  {usage.data.imageGenerations.limit === -1 ? (
    <>
      <Progress value={0} className="h-2" aria-label="Image generation usage" />
      <p className="text-sm text-muted-foreground">
        {usage.data.imageGenerations.used} used — Unlimited
      </p>
    </>
  ) : (
    <>
      <Progress
        value={Math.min(usage.data.imageGenerations.percentage, 100)}
        className="h-2"
        indicatorClassName={getProgressColor(usage.data.imageGenerations.percentage)}
        aria-label="Image generation usage"
      />
      <p className={`text-sm ${getTextColor(usage.data.imageGenerations.percentage)}`}>
        {usage.data.imageGenerations.used} of {usage.data.imageGenerations.limit} used
      </p>
    </>
  )}
</div>
```

Check that `Upload`, `Sparkles`, `Search`, `Image` are imported from `lucide-react` at the top of the file. Add any missing ones.

**Verify:** `npx tsc --noEmit 2>&1 | head -20` → 0 errors.

**Commit:** `feat: add 4 missing usage meters to settings page`

---

## Task 6: Final verification

```bash
npx tsc --noEmit 2>&1 | head -20
npm run lint 2>&1 | tail -10
```

Expected: 0 type errors, 0 lint errors.
