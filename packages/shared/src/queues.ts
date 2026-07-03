/** BullMQ queue names shared between the main app, RecapForge, and homelab workers. */
export const QUEUE_NAMES = {
  multiTrack: 'multi-track-processing',
} as const;

/** Mirrors src/lib/queue/multi-track-queue.ts — extended with userId for BYO-key resolution (Phase 3). */
export interface MultiTrackJobData {
  uploadGroupId: string;
  sessionId: string;
  campaignId: string;
  /** Uploading user, used by the worker to resolve a BYO AssemblyAI key. Absent = env-key fallback. */
  userId?: string;
}
