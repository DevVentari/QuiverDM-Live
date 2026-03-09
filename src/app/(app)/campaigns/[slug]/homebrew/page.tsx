'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { AddFromLibraryDialog } from '@/components/homebrew/add-from-library-dialog';
import { BookOpen, Upload, Search, Library } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignHomebrewPage() {
  const { campaignId, isDM } = useCampaign();
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const content = trpc.homebrew.getContent.useQuery({
    campaignId,
    search: search || undefined,
  }, { staleTime: 30_000 });

  const pdfs = trpc.homebrewPdf.getPDFs.useQuery({ campaignId }, { staleTime: 30_000 });
  const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
  const createPDF = trpc.homebrewPdf.createPDF.useMutation();
  const updateSharingMutation = trpc.homebrew.updateSharing.useMutation({
    onSuccess: () => {
      void utils.homebrew.getContent.invalidate({
        campaignId,
        search: search || undefined,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Invalid file type', { description: 'Please upload a PDF file (.pdf)' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large', {
        description: `Maximum file size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const upload = await getUploadUrl.mutateAsync({ filename: file.name, fileSize: file.size, campaignId });

      if (upload.presignedUrl && upload.r2Key && upload.r2Url) {
        const putRes = await fetch(upload.presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/pdf' },
        });
        if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status})`);

        await createPDF.mutateAsync({
          filename: file.name,
          fileSize: file.size,
          mimeType: 'application/pdf',
          r2Url: upload.r2Url,
          r2Key: upload.r2Key,
          campaignId,
        });

        toast.success('PDF uploaded successfully', { description: `${file.name} is being processed` });
        void pdfs.refetch();
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('campaignId', campaignId);
        const res = await fetch('/api/homebrew/upload-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
        toast.success('PDF uploaded successfully', { description: `${file.name} is being processed` });
        void pdfs.refetch();
      }
    } catch (err: any) {
      if (err?.data?.code === 'TOO_MANY_REQUESTS') {
        toast.error('Upload limit reached', { description: 'You have reached your monthly PDF upload limit.' });
      } else {
        toast.error('Upload failed', {
          description: err instanceof Error ? err.message : 'Network error.',
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Homebrew Content</h2>
        <div className="flex flex-wrap items-center gap-2">
          {isDM && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLibraryOpen(true)}
              disabled={!isDM}
            >
              <Library className="mr-2 h-4 w-4" />
              Add from Library
            </Button>
          )}
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
            <div key={item.id} className="space-y-2">
              <HomebrewContentCard
                item={item}
                href={`/homebrew/${item.id}`}
              />
              {isDM && (
                <div className="flex items-center gap-2 px-1">
                  <Switch
                    id={`share-${item.id}`}
                    checked={Boolean(item.sharedWithPlayers)}
                    onCheckedChange={(checked: boolean) =>
                      updateSharingMutation.mutate({
                        homebrewId: item.id,
                        sharedWithPlayers: checked,
                      })
                    }
                  />
                  <Label htmlFor={`share-${item.id}`} className="text-xs">
                    Share with players
                  </Label>
                </div>
              )}
            </div>
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

      <AddFromLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        campaignId={campaignId}
        campaignItems={((content.data as any)?.items || []).map((item: any) => ({ id: item.id }))}
        onAdded={() => content.refetch()}
      />
    </div>
  );
}
