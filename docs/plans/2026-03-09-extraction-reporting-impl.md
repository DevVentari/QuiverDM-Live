# AI Extraction Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show live chunk-by-chunk progress during AI extraction and a type-breakdown summary on both the PDF list and detail pages.

**Architecture:** Add two nullable fields to `HomebrewPDF`. The extraction service writes progress after each chunk via DB update. The UI polls `getJobStatus` (detail page) and `getPDFs` (list page) every 2s while extraction is active — same polling pattern already used for PDF conversion progress.

**Tech Stack:** Prisma schema migration, tRPC, React `refetchInterval` polling

---

### Task 1: Schema — add extraction progress fields

**Files:**
- Modify: `prisma/schema.prisma` around line 903 (after `imageExtractionStatus`)

**Step 1: Add the two fields to HomebrewPDF model**

In `prisma/schema.prisma`, after the `imageExtractionStatus` line (around line 903), add:

```prisma
  // AI extraction progress
  aiExtractionStatus    String?   // null | 'processing' | 'done' | 'error'
  aiExtractionProgress  Json?     // { chunk: number, totalChunks: number, itemsFound: number, byType: Record<string,number> }
```

**Step 2: Push schema**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

**Step 3: Verify Prisma client picked up the new fields**

```bash
npx tsx -e "import { prisma } from './src/lib/prisma'; prisma.homebrewPDF.findFirst().then(r => console.log(Object.keys(r ?? {}))).finally(() => prisma.\$disconnect())"
```

Expected: output includes `aiExtractionStatus` and `aiExtractionProgress`

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add aiExtractionStatus/Progress fields to HomebrewPDF"
```

---

### Task 2: Repository — expose new fields in update()

**Files:**
- Modify: `src/server/repositories/homebrew-pdf.repository.ts:109-125`

**Step 1: Add fields to the update() type signature**

The `update()` function at line 109 has a typed `data` parameter. Add the two new fields:

```typescript
export async function update(
  pdfId: string,
  data: {
    useLLM?: boolean;
    processingStatus?: string;
    markerProcessed?: boolean;
    markdownContent?: string | null;
    markerMetadata?: any;
    errorMessage?: string | null;
    processingEndedAt?: Date;
    aiExtractionStatus?: string | null;
    aiExtractionProgress?: any;
  }
) {
  return prisma.homebrewPDF.update({
    where: { id: pdfId },
    data,
  });
}
```

Note: `findByIdAndUser` and `findByUser` both use `findFirst`/`findMany` without a `select` — they already return all fields automatically. No changes needed there.

**Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to this file.

**Step 3: Commit**

```bash
git add src/server/repositories/homebrew-pdf.repository.ts
git commit -m "feat: expose aiExtraction fields in PDF repository update"
```

---

### Task 3: Extraction function — add onChunkProgress callback

**Files:**
- Modify: `src/lib/ai/extraction.ts:576-660` (`extractContent` function)
- Modify: `src/lib/ai/extraction.ts:677-754` (`extractWithFallback` function)

**Step 1: Add callback parameter to extractContent**

The `extractContent` function signature at line 576 currently is:

```typescript
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini',
  userKeys?: { geminiApiKey?: string },
  userId?: string
): Promise<ExtractionResult>
```

Change to:

```typescript
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini',
  userKeys?: { geminiApiKey?: string },
  userId?: string,
  onChunkProgress?: (chunk: number, totalChunks: number, itemsFound: number, byType: Record<string, number>) => Promise<void>
): Promise<ExtractionResult>
```

**Step 2: Call the callback after each successful chunk**

Inside the chunk loop (around line 622), after `allItems.push(...result.items)`:

```typescript
      if (result.success) {
        allItems.push(...result.items);
        totalTokens += result.tokensUsed || 0;
        totalTokensIn += result.tokensIn || 0;
        totalTokensOut += result.tokensOut || 0;
        console.log(`[AI Extraction] Chunk ${i + 1}: Found ${result.items.length} items`);

        // Report progress after each successful chunk
        if (onChunkProgress) {
          const byType: Record<string, number> = {};
          for (const item of allItems) {
            byType[item.type] = (byType[item.type] || 0) + 1;
          }
          await onChunkProgress(i + 1, chunks.length, allItems.length, byType);
        }
      }
```

**Step 3: Thread callback through extractWithFallback**

The `extractWithFallback` signature at line 677:

```typescript
export async function extractWithFallback(
  markdown: string,
  preferredProvider?: ExtractionProvider,
  userKeys?: { geminiApiKey?: string },
  userId?: string,
  onChunkProgress?: (chunk: number, totalChunks: number, itemsFound: number, byType: Record<string, number>) => Promise<void>
): Promise<ExtractionResult>
```

Inside the function, pass it through to `extractContent`:

```typescript
      const result = await extractContent(markdown, provider, userKeys, userId, onChunkProgress);
```

(There is one `extractContent` call inside `extractWithFallback` at line ~722.)

**Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/lib/ai/extraction.ts
git commit -m "feat: add onChunkProgress callback to extraction functions"
```

---

### Task 4: Service — set status and write progress

**Files:**
- Modify: `src/server/services/homebrew-pdf.service.ts:335-396` (`extractContent` method)

**Step 1: Replace the extractContent method body**

The current method at line 335 calls `extractWithFallback` and then updates `markerMetadata`. Replace the entire method body with:

```typescript
  async extractContent(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'PDF not found' });
    }

    if (!pdf.markdownContent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PDF has not been processed yet. Please wait for processing to complete.',
      });
    }

    // Mark extraction as in-progress
    await homebrewPdfRepository.update(pdfId, {
      aiExtractionStatus: 'processing',
      aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: 0, byType: {} },
    });

    const onChunkProgress = async (
      chunk: number,
      totalChunks: number,
      itemsFound: number,
      byType: Record<string, number>
    ) => {
      await homebrewPdfRepository.update(pdfId, {
        aiExtractionProgress: { chunk, totalChunks, itemsFound, byType },
      });
    };

    try {
      const extractionResult = await extractWithFallback(
        pdf.markdownContent,
        undefined,
        undefined,
        userId,
        onChunkProgress
      );

      if (!extractionResult.success) {
        await homebrewPdfRepository.update(pdfId, { aiExtractionStatus: 'error' });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: extractionResult.error || 'Extraction failed',
        });
      }

      if (extractionResult.items.length === 0) {
        await homebrewPdfRepository.update(pdfId, {
          aiExtractionStatus: 'done',
          aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: 0, byType: {} },
        });
        return {
          success: true,
          message: 'No extractable content found in the PDF',
          itemsExtracted: 0,
          tokensUsed: extractionResult.tokensUsed,
        };
      }

      const saveResult = await saveExtractedContent(
        extractionResult.items,
        userId,
        pdfId,
        pdf.campaignId,
        prisma
      );

      // Build final byType breakdown
      const byType: Record<string, number> = {};
      for (const item of extractionResult.items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      const currentMetadata = (pdf.markerMetadata as Record<string, unknown>) || {};
      await homebrewPdfRepository.update(pdfId, {
        aiExtractionStatus: 'done',
        aiExtractionProgress: {
          chunk: extractionResult.items.length > 0 ? 1 : 0,
          totalChunks: 1,
          itemsFound: saveResult.saved,
          byType,
        },
        markerMetadata: {
          ...currentMetadata,
          extractionTokensUsed: extractionResult.tokensUsed,
          itemsExtracted: saveResult.saved,
          extractionErrors: saveResult.errors.length,
          lastExtractionAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: `Successfully extracted ${saveResult.saved} items`,
        itemsExtracted: saveResult.saved,
        tokensUsed: extractionResult.tokensUsed,
        errors: saveResult.errors,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      await homebrewPdfRepository.update(pdfId, { aiExtractionStatus: 'error' });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Extraction failed',
      });
    }
  }
```

**Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/server/services/homebrew-pdf.service.ts
git commit -m "feat: write extraction progress to DB chunk-by-chunk"
```

---

### Task 5: UI — PDF list cards show extraction summary

**Files:**
- Modify: `src/app/(app)/homebrew/pdfs/page.tsx`

**Step 1: Update PdfItem type to include extraction fields**

Around line 48, the `PdfItem` type currently is:

```typescript
type PdfItem = {
  id: string;
  filename: string;
  fileSize: number;
  createdAt: string;
  processingStatus: string;
  errorMessage?: string | null;
};
```

Change to:

```typescript
type PdfItem = {
  id: string;
  filename: string;
  fileSize: number;
  createdAt: string;
  processingStatus: string;
  errorMessage?: string | null;
  aiExtractionStatus?: string | null;
  aiExtractionProgress?: {
    chunk: number;
    totalChunks: number;
    itemsFound: number;
    byType: Record<string, number>;
  } | null;
};
```

**Step 2: Enable polling while extraction is active**

In `PDFListCard` (around line 146), update the `isActive` condition:

```typescript
  const isExtracting = pdf.aiExtractionStatus === 'processing';
  const isActive = pdf.processingStatus === 'pending' || pdf.processingStatus === 'processing' || isExtracting;
```

The `statusQuery` already uses `isActive` for polling — no further change needed there.

**Step 3: Add extraction progress bar and summary to the card**

After the main progress bar (the `isActive` block around line 198), add extraction status rendering. Replace the existing `isActive` CardContent block and add a second block:

```tsx
      {isActive && pdf.processingStatus !== 'completed' ? (
        <CardContent className="space-y-2 px-5 pb-4 pt-0">
          <Progress value={progress} className="h-2" indicatorClassName="bg-blue-500" />
          <p className="text-xs text-muted-foreground">
            {currentStage}
            {estimated ? ` • ${estimated}` : ''}
          </p>
        </CardContent>
      ) : null}

      {isExtracting ? (
        <CardContent className="space-y-2 px-5 pb-2 pt-0">
          <Progress
            value={
              pdf.aiExtractionProgress?.totalChunks
                ? Math.round((pdf.aiExtractionProgress.chunk / pdf.aiExtractionProgress.totalChunks) * 100)
                : 0
            }
            className="h-1.5"
            indicatorClassName="bg-amber-500"
          />
          <p className="text-xs text-muted-foreground">
            Extracting content… chunk {pdf.aiExtractionProgress?.chunk ?? 0} of {pdf.aiExtractionProgress?.totalChunks ?? '?'}
            {pdf.aiExtractionProgress?.itemsFound ? ` • ${pdf.aiExtractionProgress.itemsFound} items found` : ''}
          </p>
        </CardContent>
      ) : null}

      {pdf.aiExtractionStatus === 'done' && pdf.aiExtractionProgress?.itemsFound ? (
        <CardContent className="px-5 pb-3 pt-0">
          <p className="text-xs text-muted-foreground">
            {pdf.aiExtractionProgress.itemsFound} items extracted
            {Object.keys(pdf.aiExtractionProgress.byType ?? {}).length > 0
              ? ' · ' + Object.entries(pdf.aiExtractionProgress.byType)
                  .map(([type, count]) => `${count} ${type}`)
                  .join(' · ')
              : ''}
          </p>
        </CardContent>
      ) : null}
```

**Step 4: Test locally**

Run `npm run dev` and upload a PDF. After processing completes, click "Extract D&D Content". Watch the card on `/homebrew/pdfs` — it should show an amber progress bar while chunks process, then a summary line like `47 items extracted · 12 spell · 8 monster · 3 item`.

**Step 5: Commit**

```bash
git add src/app/\(app\)/homebrew/pdfs/page.tsx
git commit -m "feat: show extraction progress and summary on PDF list cards"
```

---

### Task 6: UI — PDF detail page live extraction progress

**Files:**
- Modify: `src/app/(app)/homebrew/pdfs/[pdfId]/page.tsx`

**Step 1: Read extraction status from getJobStatus**

The `getJobStatus` query at line 28 returns `{ pdf, job }` where `pdf` is the full DB row including the new fields. The PDF object in the detail page is from `homebrewPdf.getPDF` not `getJobStatus`. Add a second polling query for extraction status:

After the existing `extractedContent` query (around line 39), add:

```typescript
  const extractionStatus = trpc.homebrewPdf.getJobStatus.useQuery(
    { pdfId },
    {
      enabled: data?.processingStatus === 'completed',
      refetchInterval: (query) => {
        const pdf = (query.state.data as any)?.pdf;
        return pdf?.aiExtractionStatus === 'processing' ? 2000 : false;
      },
      refetchIntervalInBackground: false,
    }
  );

  const extractionPdf = (extractionStatus.data as any)?.pdf;
  const isExtracting = extractionPdf?.aiExtractionStatus === 'processing';
  const extractionProgress = extractionPdf?.aiExtractionProgress as {
    chunk: number;
    totalChunks: number;
    itemsFound: number;
    byType: Record<string, number>;
  } | null | undefined;
```

**Step 2: Show live progress in the Extracted Content tab**

In the `TabsContent value="extracted"` section (around line 154), wrap the existing empty state (the "Extract D&D Content" button area) with an extraction progress state:

Find the block (around line 182):

```tsx
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground">
                    No D&D content has been extracted from this PDF yet.
                  </p>
                  <Button
                    onClick={() => extractMutation.mutate({ pdfId })}
                    disabled={extractMutation.isPending}
                  >
                    ...
                  </Button>
                </CardContent>
              </Card>
            )}
```

Replace with:

```tsx
            ) : isExtracting ? (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-500" />
                  <p className="text-sm font-medium">Extracting D&D content…</p>
                  {extractionProgress && extractionProgress.totalChunks > 0 ? (
                    <div className="mx-auto max-w-xs space-y-2">
                      <Progress
                        value={Math.round((extractionProgress.chunk / extractionProgress.totalChunks) * 100)}
                        className="h-2"
                        indicatorClassName="bg-amber-500"
                      />
                      <p className="text-xs text-muted-foreground">
                        Chunk {extractionProgress.chunk} of {extractionProgress.totalChunks}
                        {extractionProgress.itemsFound > 0 ? ` • ${extractionProgress.itemsFound} items found so far` : ''}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground">
                    No D&D content has been extracted from this PDF yet.
                  </p>
                  <Button
                    onClick={() => extractMutation.mutate({ pdfId })}
                    disabled={extractMutation.isPending}
                  >
                    {extractMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Extract D&D Content
                  </Button>
                </CardContent>
              </Card>
            )}
```

**Step 3: Show extraction summary above item grid**

When `items.length > 0`, the existing code shows a count line. Enhance it to show the `byType` breakdown from `extractionPdf` if available:

Find the existing summary line (around line 156):

```tsx
            {items.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{items.length} items extracted</span>
                <span className="text-muted-foreground">•</span>
                {Object.entries(typeCounts).map(([type, count]) => {
```

No change needed here — this already shows the breakdown. The `typeCounts` is computed from the actual `items` array from DB, which is accurate.

**Step 4: Trigger refetch after extraction completes**

In the `extractMutation` definition (around line 44), add an `onSuccess` callback to also refetch `extractionStatus`:

```typescript
  const extractionStatusUtils = trpc.useUtils();
  const extractMutation = trpc.homebrewPdf.extractContent.useMutation({
    onSuccess: () => {
      void extractedContent.refetch();
      void extractionStatus.refetch();
    },
  });
```

**Step 5: Type check and test**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Then test: go to a completed PDF, click "Extract D&D Content", watch the progress bar animate through chunks.

**Step 6: Commit**

```bash
git add src/app/\(app\)/homebrew/pdfs/\[pdfId\]/page.tsx
git commit -m "feat: live extraction progress on PDF detail page"
```

---

## Verification

After all tasks:

1. Upload a new PDF (or use existing completed one)
2. Click "Extract D&D Content" on the detail page
3. Verify amber progress bar appears with "Chunk X of Y" text
4. Verify item count updates in real time
5. After completion: detail page shows item grid; list card shows summary line like `47 items extracted · 12 spell · 8 monster`
6. Refresh both pages — summary persists from DB

```bash
npx tsc --noEmit
npm run lint
```
