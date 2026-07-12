/** BullMQ queue names shared between the main app, RecapForge, and homelab workers. */
export const QUEUE_NAMES = {
  multiTrack: 'multi-track-processing',
  forgeRecap: 'forge-recap-generation',
} as const;

/** Mirrors src/lib/queue/multi-track-queue.ts — extended with userId for BYO-key resolution (Phase 3). */
export interface MultiTrackJobData {
  uploadGroupId: string;
  sessionId: string;
  campaignId: string;
  /** Uploading user, used by the worker to resolve a BYO AssemblyAI key. Absent = env-key fallback. */
  userId?: string;
}

/** RecapForge P4 — recipe + prompt assembly for recap generation. */
export type ForgeRecapJobData = {
  campaignId: string;
  sessionId: string;
  userId: string;
};
