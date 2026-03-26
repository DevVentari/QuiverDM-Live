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
console.log(`  LLAMA_CLOUD_API_KEY: ${process.env.LLAMA_CLOUD_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { convertPdfWithPdfplumber } from '../pdf/pdfplumber-fallback';
import { convertWithDocling, isDoclingAvailable } from '../pdf/docling';
import { convertWithLlamaParse, isLlamaParseConfigured } from '../pdf/llamaparse';
import { convertPdfToMarkdown, testMarkerInstallation } from '../pdf/marker';

import { getSignedUrl, storage } from '../storage';
import type { PDFProcessingJobData, PDFProcessingJobResult } from './queue';
import { getRedisConnection } from './queue';
import { extractWithFallback, type ExtractionProvider } from '../ai/extraction';
import { saveExtractedContent } from '../../server/repositories/homebrew-extraction.repository';
import path from 'path';
import fs from 'fs/promises';
import { activeJobs } from './worker-control';
import { decrypt } from '../encryption';
import { addSourcebookSceneExtractionJob } from './sourcebook-scene-extraction-queue';

declare const __webpack_require__: unknown;

// WebSocket broadcasting is not used — frontend polls via tRPC
// Kept as no-ops so the worker code doesn't need restructuring
const broadcastPDFProgress: ((pdfId: string, progress: number) => void) | null = null;
const broadcastPDFStatus: ((pdfId: string, status: string, data?: any) => void) | null = null;

const prisma = new PrismaClient();

type ProgressLogLevel = 'info' | 'success' | 'warning' | 'error';

interface ProgressLogEntry {
  timestamp: string;
  message: string;
  level: ProgressLogLevel;
}

const MAX_PROGRESS_LOGS = 150;
const jobLogs = new Map<string, ProgressLogEntry[]>();

type ExtractedImageMetadata = { url: string; pageNumber: number };

function estimateTimeRemainingSeconds(startTime: number, progress: number): number | null {
  if (progress <= 0 || progress >= 100) return null;
  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
  const estimatedTotalSeconds = Math.floor((elapsedSeconds / progress) * 100);
  return Math.max(0, estimatedTotalSeconds - elapsedSeconds);
}

async function updateJobProgress(
  job: Job<PDFProcessingJobData, PDFProcessingJobResult>,
  pdfId: string,
  startTime: number,
  input: {
    progress: number;
    currentStep: string;
    currentSubStep?: string;
    log?: string;
    level?: ProgressLogLevel;
  }
) {
  const logs = jobLogs.get(pdfId) ?? [];
  if (input.log) {
    logs.push({
      timestamp: new Date().toISOString(),
      message: input.log,
      level: input.level ?? 'info',
    });
    if (logs.length > MAX_PROGRESS_LOGS) {
      logs.splice(0, logs.length - MAX_PROGRESS_LOGS);
    }
    jobLogs.set(pdfId, logs);
  }

  const estimatedTimeRemaining = estimateTimeRemainingSeconds(startTime, input.progress);
  const payload = {
    progress: input.progress,
    currentStep: input.currentStep,
    currentSubStep: input.currentSubStep,
    estimatedTimeRemaining,
    logs,
  };

  await job.updateProgress(payload as any);
  broadcastPDFProgress?.(pdfId, input.progress);
  broadcastPDFStatus?.(pdfId, input.currentStep, payload);
}

// Redis connection — respects REDIS_URL (Upstash/production) and falls back to local host/port
const redisConnection = getRedisConnection();

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
    // Check if PDF still exists and whether conversion already completed (retry safety)
    const existingPdf = await prisma.homebrewPDF.findUnique({
      where: { id: pdfId },
      select: { id: true, markdownContent: true, processingStatus: true },
    });

    if (!existingPdf) {
      console.log(`[Worker] PDF ${pdfId} no longer exists - skipping processing`);
      activeJobs.delete(pdfId);
      jobLogs.delete(pdfId);
      return {
        success: false,
        error: 'PDF was deleted before processing started',
        processingTime: 0,
      };
    }

    // If markdown already exists (from a previous stalled attempt), skip straight to extraction
    const existingMarkdown = existingPdf.markdownContent ?? null;

    // Update status to processing
    await prisma.homebrewPDF.update({
      where: { id: pdfId },
      data: {
        processingStatus: 'processing',
        processingStartedAt: new Date(),
      },
    });

    await updateJobProgress(job, pdfId, startTime, {
      progress: 10,
      currentStep: 'downloading',
      currentSubStep: 'Preparing secure download URL',
      log: 'Starting PDF processing job',
      level: 'info',
    });

    // Get signed URL from storage for download
    console.log(`[Worker] Generating signed URL for: ${r2Key}`);
    const signedUrl = await getSignedUrl(r2Key, 3600); // 1 hour expiry

    await updateJobProgress(job, pdfId, startTime, {
      progress: 20,
      currentStep: 'downloading',
      currentSubStep: 'Downloading PDF to worker',
      log: 'PDF download initialized',
      level: 'info',
    });

    // Download PDF to temp location — use /tmp (always writable) not cwd (read-only in production containers)
    const tempDir = process.env.TEMP_DIR ?? '/tmp/quiverdm';
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

    await updateJobProgress(job, pdfId, startTime, {
      progress: 40,
      currentStep: 'converting',
      currentSubStep: 'Validating document and preparing conversion',
      log: 'PDF downloaded successfully',
      level: 'success',
    });

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

    // Check if AI extraction is enabled
    const shouldExtract = options.useAIExtraction !== false;
    if (shouldExtract) {
      const provider = options.llmProvider;
      if (provider) {
        // Specific provider requested — check its key
        const requiredKey = providerKeyMap[provider];
        if (requiredKey && !process.env[requiredKey]) {
          console.warn(
            `[Worker] Requested provider "${provider}" has no API key (${requiredKey}). ` +
            `Falling back to auto-select (Ollama or other configured providers).`
          );
        } else {
          console.log(`[Worker] AI content extraction enabled with provider: ${provider}`);
        }
      } else {
        // Auto-select: extractWithFallback will pick best available provider (Ollama, cloud, etc.)
        const anyCloudKey = Object.values(providerKeyMap).some((k) => !!process.env[k]);
        console.log(`[Worker] AI content extraction enabled (auto-select; cloud keys: ${anyCloudKey ? 'yes' : 'no, will use Ollama'})`);
      }
    } else {
      console.log(`[Worker] AI content extraction disabled`);
    }
    // Convert PDF to Markdown — cascade: LlamaParse → Marker → Docling → pdfplumber
    // On retry after stall, skip conversion if markdown was already saved to DB
    let markdown = existingMarkdown || '';
    if (existingMarkdown) {
      console.log(`[Worker] Skipping conversion — markdown already exists (${existingMarkdown.length} chars), resuming extraction`);
    }
    let pdfMetadata: Record<string, unknown> = {};
    let doclingImages: Array<{ data: string; pageNumber: number; format: string; filename: string }> = [];
    let extractedImageMetadata: ExtractedImageMetadata[] = [];
    let imageExtractionStatus: 'completed' | 'partial' | 'failed' = 'completed';

    // Tier 1: LlamaParse (cloud API — fast, scalable)
    if (!markdown && isLlamaParseConfigured()) {
      console.log('[Worker] Converting PDF with LlamaParse...');
      await updateJobProgress(job, pdfId, startTime, {
        progress: 45,
        currentStep: 'converting',
        currentSubStep: 'Converting PDF to markdown with LlamaParse',
        log: 'Starting LlamaParse conversion',
        level: 'info',
      });

      try {
        let lastReportedProgress = 45;
        const llamaResult = await convertWithLlamaParse(tempPdfPath, (percent) => {
          const jobPercent = 40 + Math.round(percent * 0.30);
          if (jobPercent >= lastReportedProgress + 2) {
            lastReportedProgress = jobPercent;
            void updateJobProgress(job, pdfId, startTime, {
              progress: jobPercent,
              currentStep: 'converting',
              currentSubStep: `LlamaParse conversion ${percent}%`,
            });
          }
        });
        markdown = llamaResult.markdown;
        pdfMetadata = llamaResult.metadata;
        doclingImages = llamaResult.images;
        console.log(`[Worker] LlamaParse succeeded (${llamaResult.metadata.pages} pages, ${llamaResult.images.length} images, ${llamaResult.metadata.processingTimeMs}ms)`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Worker] LlamaParse failed: ${msg}`);
        await updateJobProgress(job, pdfId, startTime, {
          progress: 48,
          currentStep: 'converting',
          currentSubStep: 'LlamaParse failed, trying Marker',
          log: `LlamaParse failed: ${msg}`,
          level: 'warning',
        });
      }
    }

    // Tier 2: Marker (self-hosted — best RAG quality, CPU/GPU)
    if (!markdown) {
      const markerAvailable = await testMarkerInstallation();
      if (markerAvailable) {
        console.log('[Worker] Converting PDF with Marker...');
        await updateJobProgress(job, pdfId, startTime, {
          progress: 50,
          currentStep: 'converting',
          currentSubStep: 'Converting PDF to markdown with Marker',
          log: 'Starting Marker conversion',
          level: 'info',
        });

        try {
          const markerResult = await convertPdfToMarkdown(tempPdfPath, {
            useGPU: false,
          });
          markdown = markerResult.markdown;
          pdfMetadata = {
            ...markerResult.metadata,
            provider: 'marker',
          };
          console.log(`[Worker] Marker succeeded (${markerResult.metadata.pages} pages, ${markerResult.metadata.processingTime}s)`);
        } catch (error) {
          const markerErr = error as any;
          const msg = markerErr?.message || markerErr?.code || String(error);
          const stderr = markerErr?.stderr ? ` | stderr: ${String(markerErr.stderr).slice(0, 200)}` : '';
          console.error(`[Worker] Marker conversion failed: ${msg}${stderr}`);
          await updateJobProgress(job, pdfId, startTime, {
            progress: 53,
            currentStep: 'converting',
            currentSubStep: 'Marker failed, trying Docling',
            log: `Marker failed: ${msg}`,
            level: 'warning',
          });
        }
      } else {
        console.warn('[Worker] Marker not installed');
      }
    }

    // Tier 3: Docling (self-hosted — handles images, good quality)
    if (!markdown) {
      const doclingAvailable = await isDoclingAvailable();
      if (doclingAvailable) {
        console.log('[Worker] Converting PDF with Docling...');
        await updateJobProgress(job, pdfId, startTime, {
          progress: 55,
          currentStep: 'converting',
          currentSubStep: 'Converting PDF to markdown with Docling',
          log: 'Falling back to Docling',
          level: 'info',
        });

        try {
          let lastReportedDoclingProgress = 55;
          const doclingResult = await convertWithDocling(tempPdfPath, (percent) => {
            const jobPercent = 50 + Math.round(percent * 0.20);
            if (jobPercent >= lastReportedDoclingProgress + 2) {
              lastReportedDoclingProgress = jobPercent;
              void updateJobProgress(job, pdfId, startTime, {
                progress: jobPercent,
                currentStep: 'converting',
                currentSubStep: `Docling conversion ${percent}%`,
              });
            }
          });
          markdown = doclingResult.markdown;
          pdfMetadata = doclingResult.metadata;
          doclingImages = Array.isArray(doclingResult.images) ? doclingResult.images : [];
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[Worker] Docling conversion failed: ${msg}`);
        }
      } else {
        console.warn('[Worker] Docling not available');
      }
    }

    // Tier 4: pdfplumber (local Python — basic but always works)
    if (!markdown) {
      console.warn('[Worker] Using pdfplumber fallback');
      await updateJobProgress(job, pdfId, startTime, {
        progress: 60,
        currentStep: 'converting',
        currentSubStep: 'Falling back to pdfplumber conversion',
        log: 'Using pdfplumber fallback converter',
        level: 'warning',
      });

      const fallbackResult = await convertPdfWithPdfplumber(tempPdfPath);
      markdown = fallbackResult.markdown;
      pdfMetadata = {
        ...pdfMetadata,
        ...fallbackResult.metadata,
        usedFallback: true,
        fallbackProvider: 'pdfplumber',
      };
    }

    if (doclingImages.length > 0) {
      await updateJobProgress(job, pdfId, startTime, {
        progress: 72,
        currentStep: 'processing_images',
        currentSubStep: `Storing ${doclingImages.length} extracted images`,
        log: `Found ${doclingImages.length} images to store`,
        level: 'info',
      });

      for (let i = 0; i < doclingImages.length; i++) {
        const image = doclingImages[i];

        try {
          const format = (image.format || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
          const extension = format === 'jpeg' ? 'jpg' : format;
          const contentType = extension === 'jpg'
            ? 'image/jpeg'
            : extension === 'svg'
              ? 'image/svg+xml'
              : `image/${extension}`;

          let filenameForStorage = (image.filename || '').trim();
          if (!filenameForStorage) {
            filenameForStorage = `page${image.pageNumber}_${i + 1}.${extension}`;
          }
          filenameForStorage = filenameForStorage.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!filenameForStorage.toLowerCase().includes('.')) {
            filenameForStorage = `${filenameForStorage}.${extension}`;
          }

          const storageKey = `homebrew-images/extracted/${userId}/${pdfId}/${filenameForStorage}`;
          const imageBuffer = Buffer.from(image.data, 'base64');
          if (imageBuffer.length === 0) {
            throw new Error('Decoded image buffer is empty');
          }

          const imageUrl = await storage.upload(storageKey, imageBuffer, contentType);
          extractedImageMetadata.push({
            url: imageUrl,
            pageNumber: image.pageNumber,
          });

          await updateJobProgress(job, pdfId, startTime, {
            progress: 72 + Math.round(((i + 1) / doclingImages.length) * 8),
            currentStep: 'processing_images',
            currentSubStep: `Stored image ${i + 1}/${doclingImages.length}`,
            log: `Stored ${filenameForStorage} (page ${image.pageNumber})`,
            level: 'info',
          });
        } catch (imageError) {
          console.warn(`[Worker] Failed to store image ${i + 1}/${doclingImages.length}:`, imageError);
          await updateJobProgress(job, pdfId, startTime, {
            progress: 72 + Math.round(((i + 1) / doclingImages.length) * 8),
            currentStep: 'processing_images',
            currentSubStep: `Failed image ${i + 1}/${doclingImages.length}`,
            log: `Failed to store image ${i + 1}: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`,
            level: 'warning',
          });
        }
      }

      const successCount = extractedImageMetadata.length;
      imageExtractionStatus =
        successCount === doclingImages.length ? 'completed'
          : successCount > 0 ? 'partial'
            : 'failed';

      await updateJobProgress(job, pdfId, startTime, {
        progress: 80,
        currentStep: 'processing_images',
        currentSubStep: `Image storage ${imageExtractionStatus}`,
        log: `Stored ${successCount}/${doclingImages.length} extracted image(s)`,
        level: imageExtractionStatus === 'completed' ? 'success' : imageExtractionStatus === 'partial' ? 'warning' : 'error',
      });
    } else {
      await updateJobProgress(job, pdfId, startTime, {
        progress: 80,
        currentStep: 'processing_images',
        currentSubStep: 'No extracted images to store',
        log: 'Docling returned no images',
        level: 'info',
      });
    }

    pdfMetadata = {
      ...pdfMetadata,
      extractedImages: extractedImageMetadata.length,
      imagesDiscovered: doclingImages.length,
      imageExtractionStatus,
      imageExtractionErrors: doclingImages.length - extractedImageMetadata.length,
      extractedImageMetadata,
    };

    const result = {
      markdown,
      metadata: pdfMetadata,
    };

    await updateJobProgress(job, pdfId, startTime, {
      progress: 85,
      currentStep: 'analyzing',
      currentSubStep: 'Analyzing markdown structure',
      log: 'Markdown conversion complete',
      level: 'success',
    });

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
        jobLogs.delete(pdfId);
        return {
          success: false,
          error: 'PDF was deleted during processing',
          processingTime: Date.now() - startTime,
        };
      }
      throw dbError;
    }

    await updateJobProgress(job, pdfId, startTime, {
      progress: 90,
      currentStep: 'saving',
      currentSubStep: 'Saving markdown output to database',
      log: 'Markdown saved',
      level: 'success',
    });

    if (markdownContent) {
      await addSourcebookSceneExtractionJob({ pdfId, markdownContent });
      console.log(`[worker] Queued sourcebook scene extraction for PDF ${pdfId}`);
    }

    // Fetch user's Gemini key if available (allows per-user key without server env key)
    let userGeminiKey: string | undefined;
    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { geminiApiKey: true },
      });
      if (userSettings?.geminiApiKey) {
        userGeminiKey = decrypt(userSettings.geminiApiKey);
      }
    } catch {
      // Non-fatal: fall back to server env key or other providers
    }

    // Only extract content if useAIExtraction is enabled (defaults to true for backwards compat)
    if (shouldExtract) {
      const extractionProvider: ExtractionProvider | undefined = options.llmProvider;
      console.log(`[Worker] Starting content extraction${extractionProvider ? ` with ${extractionProvider}` : ' (auto-select)'}...`);
      await updateJobProgress(job, pdfId, startTime, {
        progress: 92,
        currentStep: 'extracting',
        currentSubStep: 'Extracting D&D entities with AI',
        log: `Starting content extraction${extractionProvider ? ` (${extractionProvider})` : ''} with ${extractedImageMetadata.length} extracted image references`,
        level: 'info',
      });

      try {
        const extractionPayload = {
          markdown: markdownContent,
          extractedImages: extractedImageMetadata,
        };

        const extractionResult = await extractWithFallback(
          extractionPayload.markdown,
          extractionProvider,
          userGeminiKey ? { geminiApiKey: userGeminiKey } : undefined,
          userId
        );

        if (extractionResult.success && extractionResult.items.length > 0) {
          console.log(`[Worker] Extracted ${extractionResult.items.length} items via ${extractionResult.provider}, saving...`);
          await updateJobProgress(job, pdfId, startTime, {
            progress: 94,
            currentStep: 'saving',
            currentSubStep: `Saving ${extractionResult.items.length} extracted items`,
            log: `Saving ${extractionResult.items.length} extracted items`,
            level: 'info',
          });

          const saveResult = await saveExtractedContent(
            extractionResult.items,
            userId,
            pdfId,
            campaignId,
            prisma,
            extractedImageMetadata
          );

          console.log(`[Worker] Saved ${saveResult.saved} items to homebrew library`);
          if (saveResult.errors.length > 0) {
            console.warn(`[Worker] Extraction save errors:`, saveResult.errors);
          }

          // Update metadata with extraction info
          const updatedMetadata = {
            ...result.metadata,
            extractedImages: extractionPayload.extractedImages.length,
            extractedImageMetadata: extractionPayload.extractedImages,
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

          await updateJobProgress(job, pdfId, startTime, {
            progress: 95,
            currentStep: 'saving',
            currentSubStep: `Saved ${saveResult.saved} extracted items`,
            log: `Extraction complete: ${saveResult.saved} item(s) saved`,
            level: 'success',
          });
        } else {
          console.log(`[Worker] No content extracted: ${extractionResult.error || 'No items found'}`);

          // Update metadata to reflect extraction completed but found nothing
          const updatedMetadata = {
            ...result.metadata,
            extractedImages: extractionPayload.extractedImages.length,
            extractedImageMetadata: extractionPayload.extractedImages,
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
          extractedImages: extractedImageMetadata.length,
          extractedImageMetadata,
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

        await updateJobProgress(job, pdfId, startTime, {
          progress: 95,
          currentStep: 'extracting',
          currentSubStep: 'Extraction failed, keeping converted markdown',
          log: `Extraction failed: ${errorMsg}`,
          level: 'error',
        });
      }
    } else {
      console.log(`[Worker] AI extraction disabled, skipping content extraction`);
      await updateJobProgress(job, pdfId, startTime, {
        progress: 95,
        currentStep: 'saving',
        currentSubStep: 'Skipping AI extraction by configuration',
        log: 'AI extraction disabled for this PDF',
        level: 'info',
      });
    }

    await updateJobProgress(job, pdfId, startTime, {
      progress: 100,
      currentStep: 'completed',
      currentSubStep: 'PDF processing complete',
      log: 'PDF is ready for review',
      level: 'success',
    });

    // Clean up job tracking
    activeJobs.delete(pdfId);
    jobLogs.delete(pdfId);

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

    try {
      await updateJobProgress(job, pdfId, startTime, {
        progress: Math.max(1, typeof (job.progress as any)?.progress === 'number' ? (job.progress as any).progress : 1),
        currentStep: 'failed',
        currentSubStep: errorMessage,
        log: `Processing failed: ${errorMessage}`,
        level: 'error',
      });
    } catch (progressError) {
      console.warn('[Worker] Failed to update job progress with error state:', progressError);
    }

    // Clean up job tracking
    activeJobs.delete(pdfId);
    jobLogs.delete(pdfId);

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
      connection: redisConnection as any,
      concurrency, // Process up to N jobs simultaneously
      limiter: {
        max: concurrency, // Maximum concurrent jobs
        duration: 1000, // Per second
      },
      lockDuration: 1800000, // 30 minutes — extraction of large PDFs (28 chunks) takes 8-10 min
      stalledInterval: 600000, // Check for stalled jobs every 10 minutes
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


