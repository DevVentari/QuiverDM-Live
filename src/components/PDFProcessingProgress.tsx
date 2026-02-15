'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { usePDFProgress } from '@/hooks/usePDFProgress';
import { FileText, Download, Settings, FileSearch, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PDFProcessingProgressProps {
  pdfId: string;
  filename?: string;
  /** Called when processing finishes (completed or failed) */
  onComplete?: () => void;
}

/** Map BullMQ progress values to human-readable stages */
function getStageFromProgress(progress: number): { label: string; icon: React.ElementType } {
  if (progress >= 100) return { label: 'Complete', icon: CheckCircle };
  if (progress >= 90) return { label: 'Extracting D&D Content', icon: FileSearch };
  if (progress >= 85) return { label: 'Saving Markdown', icon: FileText };
  if (progress >= 40) return { label: 'Converting to Markdown', icon: FileText };
  if (progress >= 20) return { label: 'Preparing PDF', icon: Settings };
  if (progress >= 10) return { label: 'Downloading PDF', icon: Download };
  return { label: 'Queued', icon: Loader2 };
}

/**
 * PDF processing progress indicator using tRPC polling.
 * Polls getJobStatus every 3s, shows progressive stage updates.
 */
export function PDFProcessingProgress({ pdfId, filename, onComplete }: PDFProcessingProgressProps) {
  const { progress, processingStatus, isProcessing, error } = usePDFProgress(pdfId);

  const isComplete = processingStatus === 'completed';
  const isFailed = processingStatus === 'failed';
  const stage = isFailed
    ? { label: 'Processing Failed', icon: AlertCircle }
    : getStageFromProgress(progress);
  const StageIcon = stage.icon;

  // Notify parent when processing finishes
  useEffect(() => {
    if (!isProcessing && onComplete) {
      onComplete();
    }
  }, [isProcessing, onComplete]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StageIcon className={`h-4 w-4 ${isProcessing ? 'animate-pulse' : ''} text-muted-foreground`} />
            <CardTitle className="text-base">
              {filename || 'Processing PDF'}
            </CardTitle>
          </div>
          <Badge variant={isComplete ? 'default' : isFailed ? 'destructive' : 'secondary'}>
            {isComplete ? 'Complete' : isFailed ? 'Failed' : `${progress}%`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        <Progress value={progress} className="h-2" />

        {/* Stage Label */}
        <p className="text-sm text-muted-foreground">{stage.label}</p>

        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
