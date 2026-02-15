/**
 * Worker Control — abort/cancel interface for active PDF jobs
 *
 * This module is safe to import from Next.js app code (services, routers).
 * It does NOT import BullMQ Worker, so webpack won't bundle the worker.
 */

import type { MarkerConversionHandle } from '../pdf/marker';
import fs from 'fs/promises';

/** Track active jobs for cancellation — populated by the standalone worker process */
export const activeJobs = new Map<string, { handle?: MarkerConversionHandle; tempPath?: string }>();

/**
 * Abort an active job (called when PDF is deleted while processing)
 */
export function abortJob(pdfId: string) {
  const job = activeJobs.get(pdfId);
  if (job) {
    console.log(`[Worker Control] Aborting job for PDF: ${pdfId}`);
    if (job.handle) {
      job.handle.abort();
    }
    if (job.tempPath) {
      fs.unlink(job.tempPath).catch(() => {});
    }
    activeJobs.delete(pdfId);
  }
}
