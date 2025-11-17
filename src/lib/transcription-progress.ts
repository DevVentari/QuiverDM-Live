import { PrismaClient } from '@prisma/client';
import { broadcastTranscriptionProgress } from '@/server/websocket';

const prisma = new PrismaClient();

export type TranscriptionStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type TranscriptionStep =
  | 'extracting_audio'
  | 'splitting_chunks'
  | 'transcribing'
  | 'diarizing'
  | 'saving';

export interface TranscriptionProgress {
  jobId: string;
  status: TranscriptionStatus;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  currentStep?: TranscriptionStep;
  currentSubStep?: string;
  estimatedTimeRemaining?: number;
  progressDetails?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Create a new transcription job
 */
export async function createTranscriptionJob(params: {
  sessionId: string;
  recordingId?: string;
  filePath: string;
  modelSize: string;
  language?: string;
  useGPU: boolean;
  useSpeakers?: boolean;
  speakerNames?: string[];
  numSpeakers?: number;
}): Promise<string> {
  const job = await prisma.transcriptionJob.create({
    data: {
      sessionId: params.sessionId,
      recordingId: params.recordingId,
      filePath: params.filePath,
      modelSize: params.modelSize,
      language: params.language,
      useGPU: params.useGPU,
      useSpeakers: params.useSpeakers || false,
      speakerNames: params.speakerNames || [],
      numSpeakers: params.numSpeakers,
      status: 'queued',
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
    },
  });

  return job.id;
}

/**
 * Update transcription job progress
 */
export async function updateTranscriptionProgress(
  jobId: string,
  update: {
    status?: TranscriptionStatus;
    progress?: number;
    currentChunk?: number;
    totalChunks?: number;
    currentStep?: TranscriptionStep;
    currentSubStep?: string;
    estimatedTimeRemaining?: number;
    progressDetails?: Record<string, any>;
    errorMessage?: string;
  }
): Promise<void> {
  const data: any = { ...update };

  // Set timestamps based on status
  if (update.status === 'processing' && !data.startedAt) {
    data.startedAt = new Date();
  } else if (
    update.status === 'completed' ||
    update.status === 'failed'
  ) {
    data.completedAt = new Date();
  }

  await prisma.transcriptionJob.update({
    where: { id: jobId },
    data,
  });

  // Broadcast update to WebSocket clients
  const updatedProgress = await getTranscriptionProgress(jobId);
  if (updatedProgress) {
    broadcastTranscriptionProgress(jobId, updatedProgress);
  }
}

/**
 * Get transcription job progress
 */
export async function getTranscriptionProgress(
  jobId: string
): Promise<TranscriptionProgress | null> {
  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    status: job.status as TranscriptionStatus,
    progress: job.progress,
    currentChunk: job.currentChunk,
    totalChunks: job.totalChunks,
    currentStep: job.currentStep as TranscriptionStep | undefined,
    currentSubStep: job.currentSubStep || undefined,
    estimatedTimeRemaining: job.estimatedTimeRemaining || undefined,
    progressDetails: (job.progressDetails as Record<string, any>) || undefined,
    errorMessage: job.errorMessage || undefined,
  };
}

/**
 * Get transcription job progress by session ID
 */
export async function getTranscriptionProgressBySessionId(
  sessionId: string
): Promise<TranscriptionProgress[]> {
  const jobs = await prisma.transcriptionJob.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map((job) => ({
    jobId: job.id,
    status: job.status as TranscriptionStatus,
    progress: job.progress,
    currentChunk: job.currentChunk,
    totalChunks: job.totalChunks,
    currentStep: job.currentStep as TranscriptionStep | undefined,
    currentSubStep: job.currentSubStep || undefined,
    estimatedTimeRemaining: job.estimatedTimeRemaining || undefined,
    progressDetails: (job.progressDetails as Record<string, any>) || undefined,
    errorMessage: job.errorMessage || undefined,
  }));
}

/**
 * Mark job as completed with transcript ID
 */
export async function completeTranscriptionJob(
  jobId: string,
  transcriptId: string
): Promise<void> {
  await prisma.transcriptionJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: 100,
      transcriptId,
      completedAt: new Date(),
    },
  });
}

/**
 * Mark job as failed
 */
export async function failTranscriptionJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  await prisma.transcriptionJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    },
  });
}

/**
 * Helper to track progress during chunk processing
 */
export class TranscriptionProgressTracker {
  private startTime?: Date;

  constructor(
    private jobId: string,
    private totalChunks: number
  ) {}

  async setStep(step: TranscriptionStep): Promise<void> {
    await updateTranscriptionProgress(this.jobId, {
      currentStep: step,
    });
  }

  async startProcessing(): Promise<void> {
    this.startTime = new Date();
    await updateTranscriptionProgress(this.jobId, {
      status: 'processing',
      totalChunks: this.totalChunks,
    });
  }

  async updateChunkProgress(currentChunk: number): Promise<void> {
    const progress = Math.floor((currentChunk / this.totalChunks) * 100);
    await updateTranscriptionProgress(this.jobId, {
      currentChunk,
      progress,
    });
  }

  /**
   * Update progress with substep and details
   */
  async updateWithSubstep(
    substep: string,
    percentage?: number,
    details?: Record<string, any>
  ): Promise<void> {
    const update: any = {
      currentSubStep: substep,
      progressDetails: details,
    };

    if (percentage !== undefined && percentage !== null) {
      update.progress = Math.floor(percentage);
    }

    // Calculate ETA if we have a start time and progress
    if (this.startTime && percentage && percentage > 0) {
      const elapsedMs = Date.now() - this.startTime.getTime();
      const estimatedTotalMs = (elapsedMs / percentage) * 100;
      const remainingMs = estimatedTotalMs - elapsedMs;
      update.estimatedTimeRemaining = Math.floor(remainingMs / 1000); // Convert to seconds
    }

    await updateTranscriptionProgress(this.jobId, update);
  }

  /**
   * Handle progress event from Python script
   */
  async handleProgressEvent(event: {
    stage: string;
    percentage: number | null;
    message: string | null;
    details: Record<string, any>;
  }): Promise<void> {
    // Map Python stage to substep message
    let substep = event.message || event.stage;

    // Include chunk information if available
    if (event.details.currentChunk && event.details.totalChunks) {
      const { currentChunk, totalChunks } = event.details;
      substep = `Chunk ${currentChunk}/${totalChunks}: ${substep}`;
    }

    await this.updateWithSubstep(substep, event.percentage || undefined, event.details);
  }

  async complete(transcriptId: string): Promise<void> {
    await completeTranscriptionJob(this.jobId, transcriptId);
  }

  async fail(errorMessage: string): Promise<void> {
    await failTranscriptionJob(this.jobId, errorMessage);
  }
}
