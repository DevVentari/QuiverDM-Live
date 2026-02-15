'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFProcessingProgress } from '@/components/PDFProcessingProgress';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PDFDetailPage() {
  const params = useParams();
  const pdfId = params.pdfId as string;

  const pdf = trpc.homebrewPdf.getPDF.useQuery({ pdfId }, { staleTime: 30_000 });
  const data = pdf.data as any;

  const isProcessing = data?.processingStatus === 'pending' || data?.processingStatus === 'processing';

  // Refetch PDF data when processing completes (to get markdown content)
  const handleComplete = useCallback(() => {
    pdf.refetch();
  }, [pdf]);

  if (pdf.isLoading) {
    return <Skeleton className="h-96 rounded-lg max-w-4xl" />;
  }

  if (!data) {
    return <p className="text-destructive">PDF not found</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/homebrew/pdfs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{data.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {data.fileSize
              ? `${(data.fileSize / 1024 / 1024).toFixed(1)} MB`
              : ''}
          </p>
        </div>
        <Badge variant="secondary">{data.processingStatus || 'pending'}</Badge>
      </div>

      {/* Processing Progress (shown for pending + processing) */}
      {isProcessing && (
        <PDFProcessingProgress
          pdfId={pdfId}
          filename={data.filename}
          onComplete={handleComplete}
        />
      )}

      {/* Markdown Content */}
      {data.markdownContent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Content</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.markdownContent}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ) : !isProcessing ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {data.processingStatus === 'completed'
                ? 'No markdown content available.'
                : data.processingStatus === 'failed'
                  ? 'Processing failed. Try re-uploading the PDF.'
                  : 'No content yet.'}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
