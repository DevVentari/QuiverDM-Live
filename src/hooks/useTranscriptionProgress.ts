'use client';

import { trpc } from '@/lib/trpc';

export interface TranscriptionProgressState {
  /** Current step label */
  currentStep: string | null;
  /** 0-100 progress percentage */
  progress: number;
  /** Job status: queued, processing, completed, failed */
  status: string;
  /** Whether the job is still being processed */
  isProcessing: boolean;
  /** Error message if failed */
  error: string | null;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  /** Refetch function */
  refetch: () => void;
}

const STEP_LABELS: Record<string, string> = {
  extracting_audio: 'Extracting audio...',
  splitting_chunks: 'Splitting audio...',
  transcribing: 'Transcribing...',
  diarizing: 'Identifying speakers...',
  saving: 'Saving transcript...',
  uploading_audio: 'Uploading audio...',
  submitting_to_assemblyai: 'Submitting to AssemblyAI...',
  waiting_for_assemblyai: 'Transcribing with AI...',
  downloading_result: 'Downloading result...',
};

/**
 * Poll-based hook for transcription job progress.
 * Polls every 3s while processing, stops on terminal states.
 */
export function useTranscriptionProgress(jobId: string | null): TranscriptionProgressState {
  const query = trpc.sessionTranscription.getTranscriptionProgress.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const data = (query.state.data as any);
        if (!data) return 3000;
        if (data.status === 'completed' || data.status === 'failed') {
          return false;
        }
        return 3000;
      },
    }
  );

  const data = query.data;
  const status = data?.status ?? 'queued';
  const isProcessing = status === 'queued' || status === 'processing';
  const stepKey = data?.currentStep ?? null;
  const currentStep = stepKey ? (STEP_LABELS[stepKey] ?? stepKey) : null;

  return {
    currentStep,
    progress: data?.progress ?? 0,
    status,
    isProcessing,
    error: data?.errorMessage ?? null,
    estimatedTimeRemaining: data?.estimatedTimeRemaining ?? null,
    refetch: query.refetch,
  };
}
