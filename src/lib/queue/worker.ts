/**
 * BullMQ Worker for PDF Processing
 *
 * Background worker that processes PDF → Markdown conversion jobs
 * Run this as a separate process: `tsx src/lib/queue-worker.ts`
 */

// Load environment variables from .env.local BEFORE anything else
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

console.log('[Worker] VERSION CHECK: queue-worker.ts loaded at', new Date().toISOString());

// Log API key status (without revealing keys)
console.log('[Worker] Environment check:');
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { convertPdfWithPdfplumber } from '../pdf/pdfplumber-fallback';
import { convertWithDocling, isDoclingAvailable } from '../pdf/docling';

import { getSignedUrl } from '../storage';
import type { PDFProcessingJobData, PDFProcessingJobResult } from './queue';
import { extractWithFallback, type ExtractionProvider } from '../ai/extraction';
import { saveExtractedContent } from '../../server/repositories/homebrew-extraction.repository';
import path from 'path';
import fs from 'fs/promises';
import { activeJobs } from './worker-control';

declare const __webpack_require__: unknown;

// WebSocket broadcasting is not used — frontend polls via tRPC
// Kept as no-ops so the worker code doesn't need restructuring
const broadcastPDFProgress: ((pdfId: string, progress: number) => void) | null = null;
const broadcastPDFStatus: ((pdfId: string, status: string, data?: any) => void) | null = null;

const prisma = new PrismaClient();

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  maxRetriesPerRequest: null,
};

/**
 * Process a PDF conversion job
 */
async function processPDFJob(
  job: Job<PDFProcessingJobData, PDFProcessingJobResult>
): Promise<PDFProcessingJobResult> {
  const { pdfId, userId, campaignId, r2Key, filename, options } = job.data;
  const startTime = Date.now();

  console.log(`[Worker] Processing PDF: ${filename} (ID: ${pdfId})`);

  // Initialize tracking for this job
  activeJobs.set(pdfId, {});

  try {
    // Check if PDF still exists (may have been deleted before processing started)
    const pdfExists = await prisma.homebrewPDF.findUnique({
      where: { id: pdfId },
      select: { id: true },
    });

    if (!pdfExists) {
      console.log(`[Worker] PDF ${pdfId} no longer exists - skipping processing`);
      activeJobs.delete(pdfId);
      return {
        success: false,
        error: 'PDF was deleted before processing started',
        processingTime: 0,
      };
    }

    // Update status to processing
    await prisma.homebrewPDF.update({
      where: { id: pdfId },
      data: {
        processingStatus: 'processing',
        processingStartedAt: new Date(),
      },
    });

    await job.updateProgress(10);
    broadcastPDFProgress?.(pdfId, 10);
    broadcastPDFStatus?.(pdfId, 'downloading');

    // Get signed URL from storage for download
    console.log(`[Worker] Generating signed URL for: ${r2Key}`);
    const signedUrl = await getSignedUrl(r2Key, 3600); // 1 hour expiry

    await job.updateProgress(20);
    broadcastPDFProgress?.(pdfId, 20);

    // Download PDF to temp location
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempPdfPath = path.join(tempDir, `${pdfId}.pdf`);

    // Track temp path for cleanup on abort
    const jobTracking = activeJobs.get(pdfId);
    if (jobTracking) {
      jobTracking.tempPath = tempPdfPath;
    }

    console.log(`[Worker] Downloading PDF to: ${tempPdfPath}`);

    // Check if it's a local file path or URL
    if (signedUrl.startsWith('/api/storage/')) {
      // Local storage API URL - convert to actual file path
      const fileKey = signedUrl.replace('/api/storage/', '');
      const actualPath = path.join(process.cwd(), 'local-storage', fileKey);
      console.log(`[Worker] Copying from local storage: ${actualPath}`);
      await fs.copyFile(actualPath, tempPdfPath);
    } else if (signedUrl.startsWith('/api/files/')) {
      // Local files API URL (STORAGE_MODE=local) - convert to actual file path
      const fileKey = signedUrl.replace('/api/files/', '');
      const uploadsPath = process.env.LOCAL_STORAGE_PATH || './uploads';
      const actualPath = path.join(process.cwd(), uploadsPath, fileKey);
      console.log(`[Worker] Copying from local uploads: ${actualPath}`);
      await fs.copyFile(actualPath, tempPdfPath);
    } else if (signedUrl.startsWith('C:') || signedUrl.startsWith('\\\\') || (signedUrl.startsWith('/') && !signedUrl.startsWith('/api'))) {
      // Direct file path - just copy it
      console.log(`[Worker] Copying from file path: ${signedUrl}`);
      await fs.copyFile(signedUrl, tempPdfPath);
    } else {
      // Remote URL - fetch it
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      await fs.writeFile(tempPdfPath, Buffer.from(buffer));
    }

    await job.updateProgress(40);
    broadcastPDFProgress?.(pdfId, 40);
    broadcastPDFStatus?.(pdfId, 'preprocessing');

    // Pre-flight check: Validate API keys if LLM is requested
    const providerKeyMap: Record<string, string> = {
      gemini: 'GEMINI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
    };
    // Legacy flag retained for backward compatibility in request payloads.
    // Docling conversion does not require or use LLM keys.
    if (options.useLLM) {
      console.log('[Worker] useLLM=true received (legacy option). Conversion continues via Docling.');
    } else {
      console.log('[Worker] Using Docling for PDF conversion');
    }

    // Check if AI extraction (cheap text model) is enabled
    const shouldExtract = options.useAIExtraction !== false;
    if (shouldExtract) {
      const provider = options.llmProvider || 'gemini';
      const requiredKey = providerKeyMap[provider];

      if (requiredKey && !process.env[requiredKey]) {
        throw new Error(
          `AI content extraction requested but ${requiredKey} is not set. ` +
          `Please add ${requiredKey} to your .env.local file or disable AI extraction.`
        );
      }

      console.log(`[Worker] AI content extraction enabled with provider: ${provider}`);
    } else {
      console.log(`[Worker] AI content extraction disabled`);
    }
    // Convert PDF to Markdown using Docling REST API
    console.log('[Worker] Converting PDF to Markdown with Docling...');
    broadcastPDFStatus?.(pdfId, 'pdf_conversion');

    let markdown = '';
    let pdfMetadata: Record<string, unknown> = {};

    const doclingAvailable = await isDoclingAvailable();

    if (doclingAvailable) {
      try {
        const doclingResult = await convertWithDocling(tempPdfPath, (percent) => {
          // Map Docling progress (0-100) to overall job progress (40-85)
          const jobPercent = 40 + Math.round(percent * 0.45);
          job.updateProgress(jobPercent);
          broadcastPDFProgress?.(pdfId, jobPercent);
        });
        markdown = doclingResult.markdown;
        pdfMetadata = doclingResult.metadata;
      } catch (error) {
        console.error('[Worker] Docling conversion failed, falling back to pdfplumber:', error);
      }
    } else {
      console.warn('[Worker] Docling not available, using pdfplumber fallback');
    }

    // Fallback to pdfplumber if Docling failed or unavailable
    if (!markdown) {
      broadcastPDFStatus?.(pdfId, 'fallback_processing');
      await job.updateProgress(50);
      broadcastPDFProgress?.(pdfId, 50);

      const fallbackResult = await convertPdfWithPdfplumber(tempPdfPath);
      markdown = fallbackResult.markdown;
      pdfMetadata = {
        ...pdfMetadata,
        ...fallbackResult.metadata,
        usedFallback: true,
        fallbackProvider: 'pdfplumber',
      };
    }

    const result = {
      markdown,
      metadata: pdfMetadata,
    };

    await job.updateProgress(85);
    broadcastPDFProgress?.(pdfId, 85);
    broadcastPDFStatus?.(pdfId, 'postprocessing');

    // Clean up temp PDF
    await fs.unlink(tempPdfPath).catch(() => {});

    if (!result.markdown) {
      throw new Error('PDF conversion failed - no markdown generated');
    }

    // The markdown content is in result.markdown
    const markdownContent = result.markdown;

    // Update database with completed status
    // Check if record still exists first (may have been deleted during processing)
    try {
      await prisma.homebrewPDF.update({
        where: { id: pdfId },
        data: {
          processingStatus: 'completed',
          markdownContent,
          markerProcessed: true,
          markerMetadata: result.metadata as any, // Store metadata
          processingEndedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (dbError: any) {
      // If record was deleted during processing, clean up and exit gracefully
      if (dbError.code === 'P2025') {
        console.log(`[Worker] PDF ${pdfId} was deleted during processing - cleaning up`);
        activeJobs.delete(pdfId);
        return {
          success: false,
          error: 'PDF was deleted during processing',
          processingTime: Date.now() - startTime,
        };
      }
      throw dbError;
    }

    await job.updateProgress(90);
    broadcastPDFProgress?.(pdfId, 90);

    // Only extract content if useAIExtraction is enabled (defaults to true for backwards compat)
    if (shouldExtract) {
      const extractionProvider: ExtractionProvider | undefined = options.llmProvider;
      console.log(`[Worker] Starting content extraction${extractionProvider ? ` with ${extractionProvider}` : ' (auto-select)'}...`);
      broadcastPDFStatus?.(pdfId, 'extracting_content');

      try {
        const extractionResult = await extractWithFallback(markdownContent, extractionProvider);

        if (extractionResult.success && extractionResult.items.length > 0) {
          console.log(`[Worker] Extracted ${extractionResult.items.length} items via ${extractionResult.provider}, saving...`);
          broadcastPDFStatus?.(pdfId, 'saving_extracted_content', {
            itemCount: extractionResult.items.length,
            provider: extractionResult.provider,
          });

          const saveResult = await saveExtractedContent(
            extractionResult.items,
            userId,
            pdfId,
            campaignId,
            prisma
          );

          console.log(`[Worker] Saved ${saveResult.saved} items to homebrew library`);
          if (saveResult.errors.length > 0) {
            console.warn(`[Worker] Extraction save errors:`, saveResult.errors);
          }

          // Update metadata with extraction info
          const updatedMetadata = {
            ...result.metadata,
            extractionStatus: 'completed',
            extractionProvider: extractionResult.provider,
            extractionTokensUsed: extractionResult.tokensUsed,
            itemsExtracted: saveResult.saved,
            extractionErrors: saveResult.errors.length,
          };

          try {
            await prisma.homebrewPDF.update({
              where: { id: pdfId },
              data: { markerMetadata: updatedMetadata as any },
            });
          } catch (dbError: any) {
            if (dbError.code === 'P2025') {
              console.log(`[Worker] PDF ${pdfId} was deleted during extraction metadata update`);
            } else {
              console.warn(`[Worker] Failed to update extraction metadata:`, dbError);
            }
          }

          broadcastPDFStatus?.(pdfId, 'extraction_complete', {
            itemsExtracted: saveResult.saved,
            provider: extractionResult.provider,
          });
        } else {
          console.log(`[Worker] No content extracted: ${extractionResult.error || 'No items found'}`);

          // Update metadata to reflect extraction completed but found nothing
          const updatedMetadata = {
            ...result.metadata,
            extractionStatus: extractionResult.success ? 'completed' : 'failed',
            extractionProvider: extractionResult.provider,
            extractionError: extractionResult.error || 'No items found',
            itemsExtracted: 0,
          };

          try {
            await prisma.homebrewPDF.update({
              where: { id: pdfId },
              data: { markerMetadata: updatedMetadata as any },
            });
          } catch (dbError: any) {
            if (dbError.code !== 'P2025') {
              console.warn(`[Worker] Failed to update extraction metadata:`, dbError);
            }
          }
        }
      } catch (extractionError) {
        // Extraction failed but PDF markdown is fine — don't fail the whole job
        const errorMsg = extractionError instanceof Error ? extractionError.message : String(extractionError);
        console.error(`[Worker] Content extraction failed: ${errorMsg}`);

        // Update metadata to record extraction failure
        const updatedMetadata = {
          ...result.metadata,
          extractionStatus: 'failed',
          extractionError: errorMsg,
          itemsExtracted: 0,
        };

        try {
          await prisma.homebrewPDF.update({
            where: { id: pdfId },
            data: { markerMetadata: updatedMetadata as any },
          });
        } catch (dbError: any) {
          if (dbError.code !== 'P2025') {
            console.warn(`[Worker] Failed to update extraction metadata:`, dbError);
          }
        }

        broadcastPDFStatus?.(pdfId, 'extraction_failed', { error: errorMsg });
      }

      await job.updateProgress(95);
      broadcastPDFProgress?.(pdfId, 95);
    } else {
      console.log(`[Worker] AI extraction disabled, skipping content extraction`);
      await job.updateProgress(95);
      broadcastPDFProgress?.(pdfId, 95);
    }

    await job.updateProgress(100);
    broadcastPDFProgress?.(pdfId, 100);
    broadcastPDFStatus?.(pdfId, 'completed');

    // Clean up job tracking
    activeJobs.delete(pdfId);

    const processingTime = Date.now() - startTime;
    console.log(`[Worker] Successfully processed PDF: ${filename} in ${processingTime}ms`);
    console.log(`[Worker] Markdown length: ${markdownContent.length} characters`);
    console.log(`[Worker] Metadata: ${JSON.stringify(result.metadata)}`);

    return {
      success: true,
      markdownContent,
      processingTime,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (errorMessage.includes('FILE_NOT_FOUND')) {
        errorMessage = 'PDF file not found or inaccessible';
      } else if (errorMessage.includes('MARKDOWN_NOT_FOUND')) {
        errorMessage = 'PDF converter failed to generate markdown output';
      }
    } else if (typeof error === 'object' && error !== null) {
      const errObj = error as any;
      if (errObj.message) {
        errorMessage = errObj.message;
      }
    }

    console.error(`[Worker] Error processing PDF ${pdfId}:`, errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(`[Worker] Stack trace:`, error.stack);
    }

    // Clean up job tracking
    activeJobs.delete(pdfId);

    // Update database with failed status (if record still exists)
    try {
      await prisma.homebrewPDF.update({
        where: { id: pdfId },
        data: {
          processingStatus: 'failed',
          errorMessage,
          processingEndedAt: new Date(),
        },
      });
    } catch (dbError: any) {
      // If record was deleted, just log - it's expected for cancelled jobs
      if (dbError.code === 'P2025') {
        console.log(`[Worker] PDF ${pdfId} was deleted - skipping status update`);
      } else {
        console.error(`[Worker] Failed to update PDF status:`, dbError);
      }
    }

    return {
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Create and start the worker
 */
export function startPDFWorker(concurrency: number = 2) {
  const worker = new Worker<PDFProcessingJobData, PDFProcessingJobResult>(
    'pdf-processing',
    processPDFJob,
    {
      connection: redisConnection,
      concurrency, // Process up to N jobs simultaneously
      limiter: {
        max: concurrency, // Maximum concurrent jobs
        duration: 1000, // Per second
      },
      lockDuration: 600000, // 10 minutes - PDF processing can take 3+ min per page
      stalledInterval: 300000, // Check for stalled jobs every 5 minutes
      maxStalledCount: 1, // Only retry once if stalled
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled - will be retried automatically`);
  });

  worker.on('error', (error) => {
    console.error('[Worker] Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} has stalled`);
  });

  console.log(`[Worker] PDF processing worker started with concurrency: ${concurrency}`);

  return worker;
}

// Graceful shutdown
async function gracefulShutdown(worker: Worker) {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  await prisma.$disconnect();
  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

// Only start the worker when running as a standalone process via `npm run worker:pdf`.
// IMPORTANT: `require.main === module` is unreliable here — when webpack bundles this
// file as a dependency (via homebrew-pdf.service.ts → abortJob import), HMR re-evaluates
// it and the check can pass, creating duplicate BullMQ workers inside Next.js dev server.
// These zombie workers run in webpack context where pdfplumber spawn() fallback can fail.
// Guard with __webpack_require__ check to ensure we're in real Node.js, not webpack.
const isWebpack = typeof __webpack_require__ !== 'undefined';
if (!isWebpack && require.main === module) {
  const concurrency = parseInt(process.env.PDF_WORKER_CONCURRENCY || '2');
  const worker = startPDFWorker(concurrency);

  process.on('SIGTERM', () => gracefulShutdown(worker));
  process.on('SIGINT', () => gracefulShutdown(worker));
}

export default startPDFWorker;


