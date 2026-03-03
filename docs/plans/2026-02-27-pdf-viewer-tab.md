# PDF Viewer Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "View PDF" tab to `/homebrew/pdfs/[pdfId]` that renders the original PDF inline using react-pdf, giving users a consistent reference alongside extracted content.

**Architecture:** Install `react-pdf` (Mozilla pdfjs-dist wrapper), create a self-contained `PDFViewer` component that fetches a presigned URL via the existing `homebrewPdf.getPresignedUrl` tRPC query, then add a third tab to the existing detail page. No backend changes required.

**Tech Stack:** react-pdf v9, pdfjs-dist (bundled), tRPC query for presigned URL, shadcn/ui primitives (Button, Skeleton, Card).

---

### Task 1: Install react-pdf

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install the package**

```bash
npm install react-pdf
```

**Step 2: Verify install succeeded**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors (react-pdf ships its own types).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-pdf for inline PDF viewing"
```

---

### Task 2: Create the PDFViewer component

**Files:**
- Create: `src/components/homebrew/pdf-viewer.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker using CDN (avoids Next.js webpack worker config)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfId: string;
}

export function PDFViewer({ pdfId }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  const presignedUrlQuery = trpc.homebrewPdf.getPresignedUrl.useQuery(
    { pdfId },
    { staleTime: 50 * 60 * 1000 } // Refresh before the 1-hour expiry
  );

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  }, []);

  if (presignedUrlQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    );
  }

  if (presignedUrlQuery.isError || !presignedUrlQuery.data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">Could not load PDF. The file may have been deleted.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[80px] text-center text-sm text-muted-foreground">
            {numPages > 0 ? `${currentPage} / ${numPages}` : '—'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[48px] text-center text-sm text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
            disabled={scale >= 2.5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="overflow-auto rounded-lg border bg-muted/20">
        <Document
          file={presignedUrlQuery.data}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<Skeleton className="mx-auto h-[600px] w-full" />}
          error={
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
                <p className="text-muted-foreground">Failed to render PDF.</p>
              </CardContent>
            </Card>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="mx-auto"
            loading={<Skeleton className="mx-auto h-[600px] w-[462px]" />}
          />
        </Document>
      </div>
    </div>
  );
}
```

**Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep pdf-viewer
```

Expected: no errors on this file.

**Step 3: Commit**

```bash
git add src/components/homebrew/pdf-viewer.tsx
git commit -m "feat: add PDFViewer component with page navigation and zoom"
```

---

### Task 3: Add "View PDF" tab to the detail page

**Files:**
- Modify: `src/app/(app)/homebrew/pdfs/[pdfId]/page.tsx`

**Step 1: Import the PDFViewer component**

Add to the existing imports at the top of the file (after the existing imports):

```tsx
import { PDFViewer } from '@/components/homebrew/pdf-viewer';
```

Also add the `BookOpen` icon to the existing lucide-react import line:

```tsx
import { AlertCircle, ArrowLeft, BookOpen, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
```

**Step 2: Add the third tab trigger**

In the `<TabsList>` block (currently has two `<TabsTrigger>` elements), add a third after the `markdown` trigger:

```tsx
<TabsTrigger value="pdf" className="gap-1.5">
  <BookOpen className="h-3.5 w-3.5" />
  View PDF
</TabsTrigger>
```

**Step 3: Add the tab content panel**

After the closing `</TabsContent>` for `value="markdown"` (line ~209), add:

```tsx
<TabsContent value="pdf" className="mt-4">
  <PDFViewer pdfId={pdfId} />
</TabsContent>
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "pdfs\|pdf-viewer"
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/app/\(app\)/homebrew/pdfs/\[pdfId\]/page.tsx
git commit -m "feat: add View PDF tab to homebrew PDF detail page"
```

---

### Task 4: Manual smoke test

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Navigate to any completed PDF**

Go to `http://localhost:3847/homebrew/pdfs` → click any PDF with `completed` status.

**Step 3: Click the "View PDF" tab**

Verify:
- PDF renders after a brief load
- Page navigation buttons work (prev/next disabled correctly at boundaries)
- Zoom in/out changes scale
- Page counter shows `1 / N`

**Step 4: Test error state**

If you can temporarily break the presigned URL (or use a non-existent pdfId), verify the error card shows instead of a crash.

---

### Task 5: Handle the CSS imports (if Next.js complains)

react-pdf imports two CSS files for annotation and text layers. If the dev server throws a CSS import error:

**Files:**
- Modify: `next.config.js` (or `next.config.ts`)

**Step 1: Check for the error**

Look for: `Module parse failed: Unexpected token` on the CSS imports.

**Step 2: If the error occurs, suppress the CSS imports in the component**

Remove these two lines from `pdf-viewer.tsx`:

```tsx
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
```

And add `disableAnnotationLayer` and `disableTextLayer` props to the `<Page>` component:

```tsx
<Page
  pageNumber={currentPage}
  scale={scale}
  className="mx-auto"
  loading={<Skeleton className="mx-auto h-[600px] w-[462px]" />}
  renderAnnotationLayer={false}
  renderTextLayer={false}
/>
```

**Step 3: Commit if change was needed**

```bash
git add src/components/homebrew/pdf-viewer.tsx
git commit -m "fix: disable pdf annotation/text layers to avoid CSS import error"
```
