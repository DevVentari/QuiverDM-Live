'use client';

import { useParams } from 'next/navigation';
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

  const pdf = trpc.homebrewPdf.getPDF.useQuery({ pdfId });
  const job = trpc.homebrewPdf.getJobStatus.useQuery({ pdfId });

  if (pdf.isLoading) {
    return <Skeleton className="h-96 rounded-lg max-w-4xl" />;
  }

  if (!pdf.data) {
    return <p className="text-destructive">PDF not found</p>;
  }

  const data = pdf.data as any;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/homebrew/pdfs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{data.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {data.fileSize
              ? `${(data.fileSize / 1024 / 1024).toFixed(1)} MB`
              : ''}
          </p>
        </div>
        <Badge variant="secondary">{data.status || 'pending'}</Badge>
      </div>

      {/* Real-time Processing Progress */}
      {data.processingStatus === 'processing' && (
        <PDFProcessingProgress pdfId={pdfId} filename={data.filename} />
      )}

      {/* Job Status (for completed/failed) */}
      {job.data && data.processingStatus !== 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Status: <Badge variant="outline">{(job.data as any).status || 'unknown'}</Badge>
            </p>
            {(job.data as any).error && (
              <p className="text-sm text-destructive mt-2">{(job.data as any).error}</p>
            )}
          </CardContent>
        </Card>
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
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {data.status === 'completed'
                ? 'No markdown content available.'
                : 'PDF is still being processed...'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
