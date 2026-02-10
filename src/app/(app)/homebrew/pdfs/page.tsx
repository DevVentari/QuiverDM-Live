'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, FileText } from 'lucide-react';

export default function PDFsPage() {
  const pdfs = trpc.homebrewPdf.getPDFs.useQuery({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await fetch('/api/homebrew/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      pdfs.refetch();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            <Upload className="mr-2 h-4 w-4" />
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
                  <Badge variant="secondary">{pdf.status || 'pending'}</Badge>
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
