'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PDFsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Poll every 5s when any PDF is still processing
  const pdfs = trpc.homebrewPdf.getPDFs.useQuery({}, {
    staleTime: 30_000,
    refetchInterval: (query) => {
      const items = (query.state.data as any)?.items;
      if (!items) return false;
      const hasProcessing = items.some(
        (p: any) => p.processingStatus === 'pending' || p.processingStatus === 'processing'
      );
      return hasProcessing ? 5000 : false;
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Frontend validation
    if (file.type !== 'application/pdf') {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF file (.pdf)',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error('File too large', {
        description: `Maximum file size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/homebrew/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Not authenticated', {
            description: 'Please sign in to upload PDFs',
          });
        } else if (res.status === 429) {
          toast.error('Upload limit reached', {
            description: data.message || 'You have reached your monthly PDF upload limit.',
          });
        } else {
          toast.error('Upload failed', {
            description: data.message || data.error || `Server error (${res.status})`,
          });
        }
        return;
      }

      toast.success('PDF uploaded', {
        description: `Processing ${file.name}...`,
      });

      // Navigate to the detail page to see progress
      if (data.pdf?.id) {
        router.push(`/homebrew/pdfs/${data.pdf.id}`);
      } else {
        pdfs.refetch();
      }
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Network error. Please check your connection.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
    if (status === 'completed') return 'default';
    if (status === 'failed') return 'destructive';
    return 'secondary';
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PDFs</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </Button>
        </div>
      </div>

      {pdfs.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : pdfs.data && ((pdfs.data as any).items || []).length > 0 ? (
        <div className="space-y-3">
          {((pdfs.data as any).items || []).map((pdf: any) => (
            <Link key={pdf.id} href={`/homebrew/pdfs/${pdf.id}`}>
              <Card className="hover:border-foreground/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 py-4">
                  <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pdf.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {pdf.fileSize
                        ? `${(pdf.fileSize / 1024 / 1024).toFixed(1)} MB`
                        : 'Size unknown'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(pdf.processingStatus || 'pending')}>
                    {pdf.processingStatus === 'processing' && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    {pdf.processingStatus || 'pending'}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No PDFs uploaded yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
