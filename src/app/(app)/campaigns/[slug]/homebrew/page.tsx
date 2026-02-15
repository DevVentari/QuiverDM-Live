'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Upload, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignHomebrewPage() {
  const { campaignId } = useCampaign();
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const content = trpc.homebrew.getContent.useQuery({
    campaignId,
    search: search || undefined,
  });

  const pdfs = trpc.homebrewPdf.getPDFs.useQuery({ campaignId });

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      formData.append('campaignId', campaignId);

      const res = await fetch('/api/homebrew/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes
        if (res.status === 401) {
          toast.error('Not authenticated', {
            description: 'Please sign in to upload PDFs',
          });
        } else if (res.status === 403) {
          toast.error('Access denied', {
            description: 'You do not have permission to upload PDFs to this campaign',
          });
        } else if (res.status === 429) {
          toast.error('Upload limit reached', {
            description: data.message || 'You have reached your monthly PDF upload limit. Upgrade to Pro for more uploads.',
          });
        } else if (res.status === 400) {
          toast.error('Upload failed', {
            description: data.message || 'Invalid file or request',
          });
        } else {
          toast.error('Upload failed', {
            description: data.message || `Server error (${res.status})`,
          });
        }
        return;
      }

      // Success!
      toast.success('PDF uploaded successfully', {
        description: `${file.name} is being processed`,
      });

      pdfs.refetch();
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Network error. Please check your connection.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Homebrew Content</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search homebrew..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* PDFs */}
      {pdfs.data && ((pdfs.data as any).items || []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">PDFs</h3>
          {((pdfs.data as any).items || []).map((pdf: any) => (
            <Card key={pdf.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{pdf.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {pdf.status || 'processing'}
                  </p>
                </div>
                <Badge variant="secondary">{pdf.status || 'pending'}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content */}
      {content.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : content.data && (content.data as any).items?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {((content.data as any).items || []).map((item: any) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2">
                  {item.data?.description || 'No description'}
                </CardDescription>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No homebrew content yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
