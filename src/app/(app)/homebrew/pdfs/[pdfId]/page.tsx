'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PDFProcessingProgress } from '@/components/PDFProcessingProgress';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { getTypeStyle } from '@/lib/homebrew-utils';
import { AlertCircle, ArrowLeft, BookOpen, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PDFViewer } from '@/components/homebrew/pdf-viewer';

export default function PDFDetailPage() {
  const params = useParams();
  const pdfId = params.pdfId as string;

  const pdf = trpc.homebrewPdf.getPDF.useQuery(
    { pdfId },
    {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const data = pdf.data as any;

  const extractedContent = trpc.homebrewPdf.getExtractedContent.useQuery(
    { pdfId },
    { staleTime: 30_000, enabled: !!data && data.processingStatus === 'completed' }
  );

  const extractMutation = trpc.homebrewPdf.extractContent.useMutation({
    onSuccess: () => extractedContent.refetch(),
  });

  const reprocessMutation = trpc.homebrewPdf.processPDF.useMutation({
    onSuccess: () => pdf.refetch(),
  });

  const handleComplete = useCallback(() => {
    void pdf.refetch();
    void extractedContent.refetch();
  }, [extractedContent, pdf]);

  const [activeTab, setActiveTab] = useState('extracted');

  if (pdf.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }

  if (pdf.isError || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Card className="border-destructive/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold text-destructive">PDF Not Found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This PDF may have been deleted or you do not have permission to view it.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/homebrew/pdfs">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to PDFs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = (extractedContent.data || []) as any[];
  const typeCounts: Record<string, number> = {};
  items.forEach((item: any) => {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit gap-1.5">
          <Link href="/homebrew/pdfs">
            <ArrowLeft className="h-4 w-4" />
            Back to PDFs
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {data.processingStatus || 'pending'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => reprocessMutation.mutate({ pdfId })}
            disabled={reprocessMutation.isPending}
          >
            {reprocessMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-process
          </Button>
        </div>
      </div>

      <PDFProcessingProgress pdfId={pdfId} filename={data.filename} onComplete={handleComplete} />

      {data.processingStatus === 'completed' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="extracted" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Extracted Content
            </TabsTrigger>
            <TabsTrigger value="markdown" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Raw Markdown
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              View PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extracted" className="mt-4 space-y-4">
            {items.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{items.length} items extracted</span>
                <span className="text-muted-foreground">•</span>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const style = getTypeStyle(type);
                  return (
                    <Badge key={type} variant="outline" className={`text-xs ${style.color}`}>
                      {count} {style.label}{count !== 1 ? 's' : ''}
                    </Badge>
                  );
                })}
              </div>
            ) : null}

            {extractedContent.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item: any) => (
                  <HomebrewContentCard key={item.id} item={item} href={`/homebrew/${item.id}`} />
                ))}
              </div>
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
          </TabsContent>

          <TabsContent value="markdown" className="mt-4">
            {data.markdownContent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Markdown Content</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none">
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

          <TabsContent value="pdf" className="mt-4">
            <PDFViewer pdfId={pdfId} enabled={activeTab === 'pdf'} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

