'use client';

import { trpc } from '@/lib/trpc';

export interface PDFProgressState {
  /** 0-100 progress percentage from BullMQ job */
  progress: number;
  /** BullMQ job state: waiting, active, completed, failed */
  jobState: string | null;
  /** DB processing status: pending, processing, completed, failed */
  processingStatus: string;
  /** Whether the PDF is still being processed */
  isProcessing: boolean;
  /** Error message if failed */
  error: string | null;
  /** Refetch the PDF data (call after processing completes) */
  refetchPdf: () => void;
}

/**
 * Poll-based hook for PDF processing progress.
 * Polls getJobStatus every 3s while processing, stops when terminal.
 */
export function usePDFProgress(pdfId: string): PDFProgressState {
  const jobStatus = trpc.homebrewPdf.getJobStatus.useQuery(
    { pdfId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as any;
        if (!data) return 3000; // Poll while loading
        const state = data.job?.state;
        const dbStatus = data.pdf?.processingStatus;
        // Stop polling when terminal
        if (state === 'completed' || state === 'failed' || dbStatus === 'completed' || dbStatus === 'failed') {
          return false;
        }
        return 3000; // Poll every 3s
      },
    }
  );

  const data = jobStatus.data as any;
  const job = data?.job;
  const pdf = data?.pdf;

  const jobState = job?.state || null;
  const processingStatus = pdf?.processingStatus || 'pending';
  const progress = typeof job?.progress === 'number' ? job.progress : 0;
  const isProcessing = processingStatus === 'pending' || processingStatus === 'processing';
  const error = job?.failedReason || pdf?.errorMessage || null;

  return {
    progress,
    jobState,
    processingStatus,
    isProcessing,
    error,
    refetchPdf: jobStatus.refetch,
  };
}
