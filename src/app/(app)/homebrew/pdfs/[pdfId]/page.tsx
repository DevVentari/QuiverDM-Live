'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PDFProcessingProgress } from '@/components/PDFProcessingProgress';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { getTypeStyle } from '@/lib/homebrew-utils';
import { ArrowLeft, Sparkles, FileText, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PDFDetailPage() {
  const params = useParams();
  const pdfId = params.pdfId as string;

  const pdf = trpc.homebrewPdf.getPDF.useQuery({ pdfId }, { staleTime: 30_000 });
  const data = pdf.data as any;

  const extractedContent = trpc.homebrewPdf.getExtractedContent.useQuery(
    { pdfId },
    { staleTime: 30_000, enabled: data?.processingStatus === 'completed' }
  );

  const extractMutation = trpc.homebrewPdf.extractContent.useMutation({
    onSuccess: () => extractedContent.refetch(),
  });

  const reprocessMutation = trpc.homebrewPdf.processPDF.useMutation({
    onSuccess: () => pdf.refetch(),
  });

  const isProcessing = data?.processingStatus === 'pending' || data?.processingStatus === 'processing';

  const handleComplete = useCallback(() => {
    pdf.refetch();
  }, [pdf]);

  if (pdf.isLoading) {
    return (
      <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">PDF not found</p>;
  }

  const items = (extractedContent.data || []) as any[];

  // Group items by type for stats
  const typeCounts: Record<string, number> = {};
  items.forEach((item: any) => {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  });

  const statusVariant = data.processingStatus === 'completed' ? 'default'
    : data.processingStatus === 'failed' ? 'destructive'
    : 'secondary';

  return (
    <div className="space-y-6 max-w-4xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/homebrew/pdfs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{data.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {data.fileSize ? `${(data.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
          </p>
        </div>
        <Badge variant={statusVariant}>{data.processingStatus || 'pending'}</Badge>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <PDFProcessingProgress
          pdfId={pdfId}
          filename={data.filename}
          onComplete={handleComplete}
        />
      )}

      {/* Failed state */}
      {data.processingStatus === 'failed' && (
        <Card className="border-destructive/50">
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Processing Failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.errorMessage || 'An error occurred while processing this PDF.'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => reprocessMutation.mutate({ pdfId })}
                disabled={reprocessMutation.isPending}
              >
                {reprocessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Re-process PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed state - Tabs */}
      {data.processingStatus === 'completed' && (
        <Tabs defaultValue="extracted" className="w-full">
          <TabsList>
            <TabsTrigger value="extracted" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Extracted Content
            </TabsTrigger>
            <TabsTrigger value="markdown" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Raw Markdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extracted" className="mt-4 space-y-4">
            {/* Stats bar */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{items.length} items extracted</span>
                <span className="text-muted-foreground">—</span>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const style = getTypeStyle(type);
                  return (
                    <Badge key={type} variant="outline" className={`text-xs ${style.color}`}>
                      {count} {style.label}{count !== 1 ? 's' : ''}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Content grid */}
            {extractedContent.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item: any) => (
                  <HomebrewContentCard
                    key={item.id}
                    item={item}
                    href={`/homebrew/${item.id}`}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No D&D content has been extracted from this PDF yet.
                  </p>
                  <Button
                    onClick={() => extractMutation.mutate({ pdfId })}
                    disabled={extractMutation.isPending}
                  >
                    {extractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Extract D&D Content
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="markdown" className="mt-4">
            {data.markdownContent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Markdown Content</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]}>
                    {data.markdownContent}
                  </ReactMarkdown>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No markdown content available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
