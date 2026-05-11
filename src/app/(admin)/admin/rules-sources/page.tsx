'use client';

import { format } from 'date-fns';
import { BookOpen, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function RulesSourcesPage() {
  const utils = trpc.useUtils();
  const { data: pdfs, isLoading, isError } = trpc.rules.listAllPdfs.useQuery();

  const indexMutation = trpc.rules.indexSource.useMutation({
    onSuccess: () => {
      void utils.rules.listAllPdfs.invalidate();
      toast.success('PDF indexed as rules source');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = trpc.rules.removeSource.useMutation({
    onSuccess: () => {
      void utils.rules.listAllPdfs.invalidate();
      toast.success('Removed from rules sources');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load rules sources. Ensure your account has admin access.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="stone-card">
        <div className="stone-card-header">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Rules Sources</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Mark PDFs as rules sources so the in-session Rules Companion can search them.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {pdfs?.map((pdf) => {
          const indexingThisPdf = indexMutation.isPending && indexMutation.variables?.pdfId === pdf.id;
          const removingThisPdf = removeMutation.isPending && removeMutation.variables?.pdfId === pdf.id;

          return (
            <Card key={pdf.id} className="border-border/60 bg-card/50">
              <CardContent className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-medium">{pdf.filename}</p>
                  {pdf.indexedAt && (
                    <p className="text-xs text-muted-foreground">
                      Indexed {format(new Date(pdf.indexedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {pdf.isRulesSource && <Badge variant="secondary">Rules Source</Badge>}

                  {pdf.isRulesSource ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeMutation.mutate({ pdfId: pdf.id })}
                      disabled={removeMutation.isPending}
                    >
                      {removingThisPdf ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Minus className="mr-1 h-3 w-3" />
                      )}
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => indexMutation.mutate({ pdfId: pdf.id })}
                      disabled={indexMutation.isPending}
                    >
                      {indexingThisPdf ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-3 w-3" />
                      )}
                      Index
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {pdfs?.length === 0 && (
          <p className="text-sm text-muted-foreground">No PDFs uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
