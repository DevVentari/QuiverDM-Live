/**
 * Homebrew PDF Service
 *
 * Business logic for PDF processing.
 * Uses repository for data access and external services for processing.
 */

import { TRPCError } from '@trpc/server';
import { homebrewPdfRepository } from '../repositories/homebrew-pdf.repository';
import { deleteFromR2, getPresignedDownloadUrl, extractKeyFromUrl } from '@/lib/storage/r2';
import { getSignedUrl, isLocalStorage } from '@/lib/storage';
import {
  addPDFProcessingJob,
  getPDFProcessingJobStatus,
  cancelPDFProcessingJob,
  getQueueStats,
} from '@/lib/queue/queue';
import { extractWithFallback } from '@/lib/ai/extraction';
import { saveExtractedContent } from '../repositories/homebrew-extraction.repository';
import { abortJob } from '@/lib/queue/worker-control';
import { prisma } from '@/lib/prisma';

export class HomebrewPdfService {
  /**
   * Create a PDF record and queue for processing
   */
  async createPDF(
    userId: string,
    input: {
      filename: string;
      fileSize: number;
      mimeType?: string;
      r2Url: string;
      r2Key: string;
      campaignId?: string;
      useLLM?: boolean;
      llmProvider?: 'gemini' | 'anthropic' | 'openai';
    }
  ) {
    const pdf = await homebrewPdfRepository.create({
      userId,
      campaignId: input.campaignId,
      filename: input.filename,
      fileSize: input.fileSize,
      mimeType: input.mimeType || 'application/pdf',
      r2Url: input.r2Url,
      useLLM: input.useLLM || false,
    });

    // Automatically queue the PDF for processing
    try {
      await addPDFProcessingJob({
        pdfId: pdf.id,
        userId,
        campaignId: input.campaignId || '',
        r2Key: input.r2Key,
        filename: input.filename,
        options: {
          useLLM: input.useLLM || false,
          llmProvider: input.llmProvider,
        },
      });

      console.log(`[Homebrew PDF] Queued PDF for processing: ${pdf.id}`);
    } catch (error) {
      console.error('[Homebrew PDF] Failed to queue PDF:', error);
      // Don't throw - PDF is created, can be retried later
    }

    return pdf;
  }

  /**
   * Queue a PDF for processing
   */
  async processPDF(
    pdfId: string,
    userId: string,
    llmProvider?: 'gemini' | 'anthropic' | 'openai'
  ) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    if (pdf.processingStatus === 'processing') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PDF is already being processed',
      });
    }

    try {
      const r2Key = pdf.r2Url.startsWith('http')
        ? extractKeyFromUrl(pdf.r2Url)
        : pdf.r2Url.replace(/^\/api\/files\//, '');

      await addPDFProcessingJob({
        pdfId: pdf.id,
        userId,
        campaignId: pdf.campaignId || '',
        r2Key,
        filename: pdf.filename,
        options: {
          useLLM: pdf.useLLM,
          llmProvider,
        },
      });

      console.log(`[Homebrew PDF] Queued PDF for processing: ${pdf.id}`);

      return {
        success: true,
        message: 'PDF queued for processing',
      };
    } catch (error: any) {
      console.error('[Homebrew PDF] Failed to queue PDF:', error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to queue PDF: ${error.message}`,
      });
    }
  }

  /**
   * Get all PDFs for a user with pagination
   */
  async getPDFs(
    userId: string,
    options: {
      campaignId?: string;
      limit?: number;
      cursor?: string;
    }
  ) {
    const limit = options.limit || 50;
    const pdfs = await homebrewPdfRepository.findByUser({
      userId,
      campaignId: options.campaignId,
      limit,
      cursor: options.cursor,
    });

    let nextCursor: string | undefined = undefined;
    if (pdfs.length > limit) {
      const nextItem = pdfs.pop();
      nextCursor = nextItem!.id;
    }

    return {
      items: pdfs,
      nextCursor,
    };
  }

  /**
   * Get a single PDF with campaign info
   */
  async getPDF(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdWithCampaign(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    return pdf;
  }

  /**
   * Toggle LLM mode for a PDF
   */
  async toggleLLMMode(pdfId: string, userId: string, useLLM: boolean) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    return homebrewPdfRepository.update(pdfId, {
      useLLM,
      processingStatus: 'pending',
      markerProcessed: false,
      markdownContent: null,
      markerMetadata: undefined,
      errorMessage: null,
    });
  }

  /**
   * Delete a PDF (cancels job, removes from R2 and database)
   */
  async deletePDF(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    // Cancel any running job first
    if (pdf.processingStatus === 'processing' || pdf.processingStatus === 'pending') {
      try {
        abortJob(pdfId);
        console.log(`[Homebrew PDF] Aborted active processing for PDF: ${pdfId}`);

        const cancelled = await cancelPDFProcessingJob(pdfId);
        if (cancelled) {
          console.log(`[Homebrew PDF] Cancelled queued job for PDF: ${pdfId}`);
        }
      } catch (error) {
        console.error('[Homebrew PDF] Failed to cancel job:', error);
      }
    }

    // Delete from R2
    try {
      await deleteFromR2(pdf.r2Url);
    } catch (error) {
      console.error('[Homebrew PDF] Failed to delete from R2:', error);
    }

    // Delete from database
    await homebrewPdfRepository.remove(pdfId);

    return { success: true };
  }

  /**
   * Get PDF statistics for a user
   */
  async getStats(userId: string, campaignId?: string) {
    return homebrewPdfRepository.getStats(userId, campaignId);
  }

  /**
   * Get job status from queue
   */
  async getJobStatus(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    const jobStatus = await getPDFProcessingJobStatus(pdfId);

    return {
      pdf,
      job: jobStatus,
    };
  }

  /**
   * Cancel a processing job
   */
  async cancelJob(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    const cancelled = await cancelPDFProcessingJob(pdfId);

    if (cancelled) {
      await homebrewPdfRepository.update(pdfId, {
        processingStatus: 'failed',
        errorMessage: 'Cancelled by user',
        processingEndedAt: new Date(),
      });
    }

    return { success: cancelled };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return getQueueStats();
  }

  /**
   * Get a presigned URL for viewing a PDF
   */
  async getPresignedUrl(pdfId: string, userId: string, expiresIn: number = 3600) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    // In local storage mode, r2Url is a relative path like /api/files/{key}
    // In R2 mode, r2Url is a full HTTPS URL — extract key for presigning
    let presignedUrl: string;
    if (isLocalStorage()) {
      const key = pdf.r2Url.replace(/^\/api\/files\//, '');
      presignedUrl = await getSignedUrl(key, expiresIn);
    } else {
      const key = extractKeyFromUrl(pdf.r2Url);
      presignedUrl = await getPresignedDownloadUrl(key, expiresIn);
    }

    return {
      url: presignedUrl,
      expiresIn,
    };
  }

  /**
   * Extract content from processed PDF markdown
   */
  async extractContent(pdfId: string, userId: string) {
    const pdf = await homebrewPdfRepository.findByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

    if (!pdf.markdownContent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PDF has not been processed yet. Please wait for processing to complete.',
      });
    }

    // Mark extraction as in-progress
    await homebrewPdfRepository.update(pdfId, {
      aiExtractionStatus: 'processing',
      aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: 0, byType: {} },
    });

    const onChunkProgress = async (
      chunk: number,
      totalChunks: number,
      itemsFound: number,
      byType: Record<string, number>
    ) => {
      try {
        await homebrewPdfRepository.update(pdfId, {
          aiExtractionProgress: { chunk, totalChunks, itemsFound, byType },
        });
      } catch {
        // Don't abort extraction if a progress write fails
      }
    };

    try {
      const extractionResult = await extractWithFallback(
        pdf.markdownContent,
        undefined,
        undefined,
        userId,
        onChunkProgress
      );

      if (!extractionResult.success) {
        await homebrewPdfRepository.update(pdfId, { aiExtractionStatus: 'error' });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: extractionResult.error || 'Extraction failed',
        });
      }

      if (extractionResult.items.length === 0) {
        await homebrewPdfRepository.update(pdfId, {
          aiExtractionStatus: 'done',
          aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: 0, byType: {} },
        });
        return {
          success: true,
          message: 'No extractable content found in the PDF',
          itemsExtracted: 0,
          tokensUsed: extractionResult.tokensUsed,
        };
      }

      const saveResult = await saveExtractedContent(
        extractionResult.items,
        userId,
        pdfId,
        pdf.campaignId,
        prisma
      );

      // Build final byType breakdown
      const byType: Record<string, number> = {};
      for (const item of extractionResult.items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      const currentMetadata = (pdf.markerMetadata as Record<string, unknown>) || {};
      await homebrewPdfRepository.update(pdfId, {
        aiExtractionStatus: 'done',
        aiExtractionProgress: {
          chunk: extractionResult.items.length > 0 ? 1 : 0,
          totalChunks: 1,
          itemsFound: saveResult.saved,
          byType,
        },
        markerMetadata: {
          ...currentMetadata,
          extractionTokensUsed: extractionResult.tokensUsed,
          itemsExtracted: saveResult.saved,
          extractionErrors: saveResult.errors.length,
          lastExtractionAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: `Successfully extracted ${saveResult.saved} items`,
        itemsExtracted: saveResult.saved,
        tokensUsed: extractionResult.tokensUsed,
        errors: saveResult.errors,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      await homebrewPdfRepository.update(pdfId, { aiExtractionStatus: 'error' });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Extraction failed',
      });
    }
  }
}

export const homebrewPdfService = new HomebrewPdfService();
