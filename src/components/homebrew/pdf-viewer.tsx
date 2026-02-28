'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface PDFViewerProps {
  pdfId: string;
  enabled?: boolean;
}

export function PDFViewer({ pdfId, enabled = true }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(false);
  const renderTaskRef = useRef<any>(null);

  const presignedUrlQuery = trpc.homebrewPdf.getPresignedUrl.useQuery(
    { pdfId },
    { staleTime: 45 * 60 * 1000, enabled }
  );

  // Load PDF document when URL becomes available
  useEffect(() => {
    const url = presignedUrlQuery.data?.url;
    if (!url) return;

    let cancelled = false;
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setLoadError(false);

    (async () => {
      // webpackIgnore: true bypasses webpack bundling for pdfjs-dist (ESM-only v5
      // causes "Object.defineProperty called on non-object" when webpack wraps it).
      // The browser loads /pdf.min.mjs natively as an ES module from the public dir.
      // @ts-ignore -- browser-native ES module served from public/, bypassed by webpack
      const pdfjs = await import(/* webpackIgnore: true */ '/pdf.min.mjs') as any;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument(url).promise;
      if (!cancelled) {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      }
    })().catch((err) => {
      console.error('[PDFViewer] load error:', err?.name, err?.message, err);
      if (!cancelled) setLoadError(true);
    });

    return () => { cancelled = true; };
  }, [presignedUrlQuery.data?.url]);

  // Render the current page whenever doc / page / scale changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    (async () => {
      // Cancel any in-flight render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      if (!cancelled) renderTaskRef.current = null;
    })().catch((err: any) => {
      // RenderingCancelledException is expected when switching pages quickly
      if (err?.name !== 'RenderingCancelledException' && !cancelled) {
        setLoadError(true);
      }
    });

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale]);

  const prevPage = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const nextPage = useCallback(() => setCurrentPage((p) => Math.min(numPages, p + 1)), [numPages]);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2))), []);
  const zoomIn = useCallback(() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2))), []);

  if (presignedUrlQuery.isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-lg" />;
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
      {/* Controls toolbar — always rendered once URL is available */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous page"
            onClick={prevPage}
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
            onClick={nextPage}
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
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span data-testid="pdf-zoom-level" className="min-w-[48px] text-center text-sm text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={scale >= 2.5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      {loadError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">Failed to render PDF.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-auto rounded-lg border bg-muted/20 p-4">
          {numPages === 0 && <Skeleton className="mx-auto h-[600px] w-full" />}
          <canvas ref={canvasRef} className="mx-auto block" />
        </div>
      )}
    </div>
  );
}
