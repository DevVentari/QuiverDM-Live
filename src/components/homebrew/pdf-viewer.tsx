'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

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
    { staleTime: 45 * 60 * 1000 } // 45 min stale — 15 min safety margin before 1-hr expiry
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
            aria-label="Previous page"
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
            aria-label="Next page"
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
            aria-label="Zoom out"
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
            aria-label="Zoom in"
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
          file={presignedUrlQuery.data.url}
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
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={<Skeleton className="mx-auto h-[600px] w-[462px]" />}
          />
        </Document>
      </div>
    </div>
  );
}
