'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';
type SortKey = 'newest' | 'oldest' | 'name' | 'size';

type PdfItem = {
  id: string;
  filename: string;
  fileSize: number;
  createdAt: string;
  processingStatus: string;
  errorMessage?: string | null;
  aiExtractionStatus?: string | null;
  aiExtractionProgress?: {
    chunk: number;
    totalChunks: number;
    itemsFound: number;
    byType: Record<string, number>;
  } | null;
};

function formatFileSize(bytes?: number) {
  if (!bytes) return 'Size unknown';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUploadDate(value?: string) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusStyles(status: string) {
  if (status === 'completed') {
    return {
      className: 'border-green-500/40 bg-green-500/10 text-green-700',
      icon: CheckCircle2,
      label: 'completed',
    };
  }
  if (status === 'failed') {
    return {
      className: 'border-red-500/40 bg-red-500/10 text-red-700',
      icon: AlertTriangle,
      label: 'failed',
    };
  }
  if (status === 'processing') {
    return {
      className: 'border-blue-500/40 bg-blue-500/10 text-blue-700',
      icon: Loader2,
      label: 'processing',
    };
  }
  return {
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    icon: Clock,
    label: 'pending',
  };
}

function normalizeStage(step: string | null | undefined, progress: number) {
  if (!step) {
    if (progress >= 100) return 'Completed';
    if (progress >= 90) return 'Saving';
    if (progress >= 75) return 'Extracting';
    if (progress >= 55) return 'Analyzing';
    if (progress >= 30) return 'Converting';
    if (progress >= 10) return 'Downloading';
    return 'Queued';
  }

  const key = step.toLowerCase();
  if (key.includes('completed')) return 'Completed';
  if (key.includes('saving') || key.includes('uploading_audio')) return 'Saving';
  if (key.includes('extract') || key.includes('assemblyai')) return 'Extracting';
  if (key.includes('analy') || key.includes('transcribing')) return 'Analyzing';
  if (key.includes('convert') || key.includes('fallback') || key.includes('pdf_conversion')) return 'Converting';
  if (key.includes('download')) return 'Downloading';
  return 'Queued';
}

function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s remaining` : `${secs}s remaining`;
}

function PDFListCard({
  pdf,
  deletingPdfId,
  setDeletingPdfId,
  onConfirmDelete,
  isDeleting,
  onReprocess,
}: {
  pdf: PdfItem;
  deletingPdfId: string | null;
  setDeletingPdfId: (pdfId: string | null) => void;
  onConfirmDelete: (pdfId: string) => void;
  isDeleting: boolean;
  onReprocess: (pdfId: string) => void;
}) {
  const router = useRouter();
  const isExtracting = pdf.aiExtractionStatus === 'processing';
  const isActive = pdf.processingStatus === 'pending' || pdf.processingStatus === 'processing' || isExtracting;
  const statusInfo = getStatusStyles(pdf.processingStatus || 'pending');

  const statusQuery = trpc.homebrewPdf.getJobStatus.useQuery(
    { pdfId: pdf.id },
    {
      enabled: isActive,
      refetchInterval: isActive ? 2000 : false,
      refetchIntervalInBackground: false,
    }
  );

  const job = (statusQuery.data as any)?.job;
  const progress = typeof job?.progress === 'number' ? Math.max(0, Math.min(100, job.progress)) : pdf.processingStatus === 'completed' ? 100 : 0;
  const currentStage = normalizeStage(job?.currentStep, progress);
  const estimated = formatEta(typeof job?.estimatedTimeRemaining === 'number' ? job.estimatedTimeRemaining : null);

  const StatusIcon = statusInfo.icon;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
      onClick={() => router.push(`/homebrew/pdfs/${pdf.id}`)}
    >
      <CardHeader className="flex flex-row items-start gap-4 p-5">
        <div className="shrink-0">
          {isActive ? (
            <CircularProgress value={progress} size={68} strokeWidth={6}>
              <FileText className="h-5 w-5 text-primary" />
            </CircularProgress>
          ) : (
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border bg-muted/30">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{pdf.filename}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(pdf.fileSize)}</span>
            <span>•</span>
            <span>{formatUploadDate(pdf.createdAt)}</span>
          </div>
        </div>

        <Badge variant="outline" className={cn('gap-1.5 capitalize', statusInfo.className)}>
          <StatusIcon className={cn('h-3.5 w-3.5', pdf.processingStatus === 'processing' && 'animate-spin')} />
          {statusInfo.label}
        </Badge>
      </CardHeader>

      {isActive ? (
        <CardContent className="space-y-2 px-5 pb-4 pt-0">
          <Progress value={progress} className="h-2" indicatorClassName="bg-blue-500" />
          <p className="text-xs text-muted-foreground">
            {currentStage}
            {estimated ? ` • ${estimated}` : ''}
          </p>
        </CardContent>
      ) : null}

      {isExtracting ? (
        <CardContent className="space-y-2 px-5 pb-2 pt-0">
          <Progress
            value={
              pdf.aiExtractionProgress?.totalChunks
                ? Math.round((pdf.aiExtractionProgress.chunk / pdf.aiExtractionProgress.totalChunks) * 100)
                : 0
            }
            className="h-1.5"
            indicatorClassName="bg-amber-500"
          />
          <p className="text-xs text-muted-foreground">
            Extracting content… chunk {pdf.aiExtractionProgress?.chunk ?? 0} of {pdf.aiExtractionProgress?.totalChunks ?? '?'}
            {pdf.aiExtractionProgress?.itemsFound ? ` • ${pdf.aiExtractionProgress.itemsFound} items found` : ''}
          </p>
        </CardContent>
      ) : null}

      {pdf.aiExtractionStatus === 'done' && pdf.aiExtractionProgress?.itemsFound ? (
        <CardContent className="px-5 pb-3 pt-0">
          <p className="text-xs text-muted-foreground">
            {pdf.aiExtractionProgress.itemsFound} items extracted
            {Object.keys(pdf.aiExtractionProgress.byType ?? {}).length > 0
              ? ' · ' + Object.entries(pdf.aiExtractionProgress.byType)
                  .map(([type, count]) => `${count} ${type}`)
                  .join(' · ')
              : ''}
          </p>
        </CardContent>
      ) : null}

      <CardFooter className="flex gap-2 border-t bg-muted/20 px-5 py-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/homebrew/pdfs/${pdf.id}`);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>

        {pdf.processingStatus === 'failed' ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onReprocess(pdf.id);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-process
          </Button>
        ) : null}

        <AlertDialog
          open={deletingPdfId === pdf.id}
          onOpenChange={(open: boolean) => {
            setDeletingPdfId(open ? pdf.id : null);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete PDF?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the PDF and all extracted content. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onConfirmDelete(pdf.id);
                }}
                disabled={isDeleting}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

export default function PDFsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const pdfs = trpc.homebrewPdf.getPDFs.useQuery(
    {},
    {
      staleTime: 30_000,
      refetchInterval: (query) => {
        const items = (query.state.data as any)?.items;
        // Poll while loading or while any item is still processing
        if (!items) return 2000;
        const hasProcessing = items.some(
          (p: any) => p.processingStatus === 'pending' || p.processingStatus === 'processing'
        );
        return hasProcessing ? 2000 : false;
      },
    }
  );

  const deleteMutation = trpc.homebrewPdf.deletePDF.useMutation({
    onSuccess: () => {
      toast.success('PDF deleted');
      setDeletingPdfId(null);
      void utils.homebrewPdf.getPDFs.invalidate();
    },
    onError: (error) => {
      toast.error('Delete failed', { description: error.message });
    },
  });

  const reprocessMutation = trpc.homebrewPdf.processPDF.useMutation({
    onSuccess: () => {
      toast.success('PDF re-queued for processing');
      void utils.homebrewPdf.getPDFs.invalidate();
    },
    onError: (error) => {
      toast.error('Re-process failed', { description: error.message });
    },
  });

  const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
  const createPDF = trpc.homebrewPdf.createPDF.useMutation();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      const upload = await getUploadUrl.mutateAsync({ filename: file.name, fileSize: file.size });

      if (upload.presignedUrl && upload.r2Key && upload.r2Url) {
        // Direct browser-to-R2 upload (bypasses Vercel 4.5MB body limit)
        const putRes = await fetch(upload.presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'application/pdf' },
        });
        if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status})`);

        const pdf = await createPDF.mutateAsync({
          filename: file.name,
          fileSize: file.size,
          mimeType: 'application/pdf',
          r2Url: upload.r2Url,
          r2Key: upload.r2Key,
        });

        toast.success('PDF uploaded', { description: `Processing ${file.name}...` });
        router.push(`/homebrew/pdfs/${pdf.id}`);
      } else {
        // Local dev fallback: server-proxied upload
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/homebrew/upload-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
        toast.success('PDF uploaded', { description: `Processing ${file.name}...` });
        if (data.pdf?.id) router.push(`/homebrew/pdfs/${data.pdf.id}`);
        else void pdfs.refetch();
      }
    } catch (err: any) {
      if (err?.data?.code === 'TOO_MANY_REQUESTS') {
        toast.error('Upload limit reached', { description: 'You have reached your monthly PDF upload limit.' });
      } else {
        toast.error('Upload failed', {
          description: err instanceof Error ? err.message : 'Network error. Please check your connection.',
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const filteredAndSorted = useMemo(() => {
    const items = (((pdfs.data as any)?.items || []) as PdfItem[]).slice();
    const filtered = statusFilter === 'all'
      ? items
      : items.filter((pdf) => (pdf.processingStatus || 'pending') === statusFilter);

    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [pdfs.data, sortBy, statusFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-6">
        <div className="pdf-grid-bg absolute inset-0 opacity-50" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">PDF Processing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track every stage in real time from upload to extraction.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </Button>
            <p className="text-xs text-muted-foreground">PDF only · Max 50 MB</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'processing', 'completed', 'failed'] as StatusFilter[]).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? 'default' : 'outline'}
              className="capitalize"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        <div className="w-full sm:w-52">
          <Select value={sortBy} onValueChange={(value: string) => setSortBy(value as SortKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {pdfs.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filteredAndSorted.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredAndSorted.map((pdf) => (
            <PDFListCard
              key={pdf.id}
              pdf={pdf}
              deletingPdfId={deletingPdfId}
              setDeletingPdfId={setDeletingPdfId}
              isDeleting={deleteMutation.isPending}
              onConfirmDelete={(pdfId) => {
                if (deleteMutation.isPending) return;
                deleteMutation.mutate({ pdfId });
              }}
              onReprocess={(pdfId) => {
                if (reprocessMutation.isPending) return;
                reprocessMutation.mutate({ pdfId });
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No PDFs found</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Upload your first PDF to start live processing with stage tracking, activity logs, and extraction status.
            </p>
            <Button className="mt-5 gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload PDF
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Need campaign-level browsing? Open <Link href="/homebrew" className="underline">Homebrew Library</Link> to manage extracted content.
      </p>
    </div>
  );
}

