'use client';

import { useTranscriptionProgress } from '@/hooks/useTranscriptionProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface TranscriptionStatusProps {
  jobId: string;
  onRetry?: () => void;
  onComplete?: () => void;
}

export function TranscriptionStatus({ jobId, onRetry, onComplete }: TranscriptionStatusProps) {
  const {
    currentStep,
    progress,
    status,
    isProcessing,
    error,
    estimatedTimeRemaining,
  } = useTranscriptionProgress(jobId);

  // Notify parent when complete
  if (status === 'completed' && onComplete) {
    onComplete();
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500">
        <CheckCircle className="h-4 w-4" />
        <span>Transcription complete</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Transcription failed</span>
        </div>
        {error && (
          <p className="text-xs text-muted-foreground">{error}</p>
        )}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Processing or queued
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{currentStep ?? 'Queued...'}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {progress}%
        </Badge>
      </div>
      <Progress value={progress} className="h-1.5" />
      {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
        <p className="text-xs text-muted-foreground">
          ~{Math.ceil(estimatedTimeRemaining / 60)} min remaining
        </p>
      )}
    </div>
  );
}
