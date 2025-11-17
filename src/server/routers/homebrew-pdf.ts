import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { convertPdfToMarkdown } from '@/lib/marker';
import { downloadFromR2, deleteFromR2, getPresignedDownloadUrl, extractKeyFromUrl } from '@/lib/r2-storage';
import { addPDFProcessingJob, getPDFProcessingJobStatus, cancelPDFProcessingJob, getQueueStats } from '@/lib/queue';
import { extractContentWithGemini, saveExtractedContent } from '@/lib/gemini-extraction';
import { abortJob } from '@/lib/queue-worker';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export const homebrewPdfRouter = router({
  /**
   * Create a PDF record after file has been uploaded to R2
   * (Upload itself happens in API route)
   * Now automatically queues the PDF for processing
   */
  createPDF: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        fileSize: z.number(),
        mimeType: z.string().default('application/pdf'),
        r2Url: z.string(),
        r2Key: z.string(), // Add R2 key for job queue
        campaignId: z.string().optional(),
        useLLM: z.boolean().default(false),
        llmProvider: z.enum(['gemini', 'anthropic', 'openai']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Create PDF record with pending status
      const pdf = await prisma.homebrewPDF.create({
        data: {
          userId,
          campaignId: input.campaignId,
          filename: input.filename,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          r2Url: input.r2Url,
          useLLM: input.useLLM,
          processingStatus: 'pending',
        },
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
            useLLM: input.useLLM,
            llmProvider: input.llmProvider,
          },
        });

        console.log(`[Homebrew PDF] Queued PDF for processing: ${pdf.id}`);
      } catch (error) {
        console.error('[Homebrew PDF] Failed to queue PDF:', error);
        // Don't throw - PDF is created, can be retried later
      }

      return pdf;
    }),

  /**
   * Process a PDF to markdown using Marker (via job queue)
   * This is called automatically after upload or manually by user
   */
  processPDF: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        llmProvider: z.enum(['gemini', 'anthropic', 'openai']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get PDF record and verify ownership
      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Check if already processing
      if (pdf.processingStatus === 'processing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF is already being processed',
        });
      }

      try {
        // Extract R2 key from URL
        const r2Key = pdf.r2Url.split('/').pop() || pdf.filename;

        // Queue the job
        await addPDFProcessingJob({
          pdfId: pdf.id,
          userId,
          campaignId: pdf.campaignId || '',
          r2Key,
          filename: pdf.filename,
          options: {
            useLLM: pdf.useLLM,
            llmProvider: input.llmProvider,
          },
        });

        console.log(`[Homebrew PDF] Queued PDF for processing: ${pdf.id}`);

        // Return immediately - processing happens in background
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
    }),

  /**
   * Get all PDFs for the user (optionally filtered by campaign)
   */
  getPDFs: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const where: any = { userId };

      if (input.campaignId) {
        where.campaignId = input.campaignId;
      }

      const pdfs = await prisma.homebrewPDF.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
      });

      let nextCursor: string | undefined = undefined;
      if (pdfs.length > input.limit) {
        const nextItem = pdfs.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: pdfs,
        nextCursor,
      };
    }),

  /**
   * Get a single PDF with markdown content
   */
  getPDF: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      return pdf;
    }),

  /**
   * Toggle LLM mode and reprocess PDF
   */
  toggleLLMMode: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        useLLM: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Update LLM setting and reset to pending for reprocessing
      const updatedPdf = await prisma.homebrewPDF.update({
        where: { id: pdf.id },
        data: {
          useLLM: input.useLLM,
          processingStatus: 'pending',
          markerProcessed: false,
          markdownContent: undefined,
          markerMetadata: undefined,
          errorMessage: undefined,
        },
      });

      return updatedPdf;
    }),

  /**
   * Delete a PDF (removes from R2 and database)
   */
  deletePDF: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Cancel any running job first
      if (pdf.processingStatus === 'processing' || pdf.processingStatus === 'pending') {
        try {
          // First, abort the active process (kills subprocess and cleans up temp files)
          abortJob(input.pdfId);
          console.log(`[Homebrew PDF] Aborted active processing for PDF: ${input.pdfId}`);

          // Then remove from BullMQ queue
          const cancelled = await cancelPDFProcessingJob(input.pdfId);
          if (cancelled) {
            console.log(`[Homebrew PDF] Cancelled queued job for PDF: ${input.pdfId}`);
          }
        } catch (error) {
          console.error('[Homebrew PDF] Failed to cancel job:', error);
          // Continue with deletion even if cancellation fails
        }
      }

      // Delete from R2
      try {
        await deleteFromR2(pdf.r2Url);
      } catch (error) {
        console.error('[Homebrew PDF] Failed to delete from R2:', error);
        // Continue with database deletion even if R2 deletion fails
      }

      // Delete from database
      await prisma.homebrewPDF.delete({
        where: { id: pdf.id },
      });

      return { success: true };
    }),

  /**
   * Get PDF statistics for the user
   */
  getStats: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const where: any = { userId };
      if (input.campaignId) {
        where.campaignId = input.campaignId;
      }

      const [total, pending, processing, completed, failed] = await Promise.all([
        prisma.homebrewPDF.count({ where }),
        prisma.homebrewPDF.count({ where: { ...where, processingStatus: 'pending' } }),
        prisma.homebrewPDF.count({ where: { ...where, processingStatus: 'processing' } }),
        prisma.homebrewPDF.count({ where: { ...where, processingStatus: 'completed' } }),
        prisma.homebrewPDF.count({ where: { ...where, processingStatus: 'failed' } }),
      ]);

      return {
        total,
        byStatus: {
          pending,
          processing,
          completed,
          failed,
        },
      };
    }),

  /**
   * Get job status from queue
   */
  getJobStatus: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Get job status from queue
      const jobStatus = await getPDFProcessingJobStatus(input.pdfId);

      return {
        pdf,
        job: jobStatus,
      };
    }),

  /**
   * Cancel a processing job
   */
  cancelJob: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Cancel the job
      const cancelled = await cancelPDFProcessingJob(input.pdfId);

      if (cancelled) {
        // Update PDF status
        await prisma.homebrewPDF.update({
          where: { id: input.pdfId },
          data: {
            processingStatus: 'failed',
            errorMessage: 'Cancelled by user',
            processingEndedAt: new Date(),
          },
        });
      }

      return { success: cancelled };
    }),

  /**
   * Get queue statistics (admin/debug)
   */
  getQueueStats: protectedProcedure.query(async () => {
    const stats = await getQueueStats();
    return stats;
  }),

  /**
   * Get a presigned URL for viewing a PDF
   */
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        expiresIn: z.number().min(60).max(86400).default(3600), // 1 min to 24 hours, default 1 hour
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get PDF and verify ownership
      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Extract key from R2 URL
      const key = extractKeyFromUrl(pdf.r2Url);

      // Generate presigned URL
      const presignedUrl = await getPresignedDownloadUrl(key, input.expiresIn);

      return {
        url: presignedUrl,
        expiresIn: input.expiresIn,
      };
    }),

  /**
   * Extract content from processed PDF markdown
   */
  extractContent: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pdf = await prisma.homebrewPDF.findFirst({
        where: {
          id: input.pdfId,
          userId,
        },
      });

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

      // Extract content using Gemini
      const extractionResult = await extractContentWithGemini(pdf.markdownContent);

      if (!extractionResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: extractionResult.error || 'Extraction failed',
        });
      }

      if (extractionResult.items.length === 0) {
        return {
          success: true,
          message: 'No extractable content found in the PDF',
          itemsExtracted: 0,
          tokensUsed: extractionResult.tokensUsed,
        };
      }

      // Save extracted content to database
      const saveResult = await saveExtractedContent(
        extractionResult.items,
        userId,
        input.pdfId,
        pdf.campaignId,
        prisma
      );

      // Update PDF metadata with extraction info
      const currentMetadata = (pdf.markerMetadata as Record<string, unknown>) || {};
      await prisma.homebrewPDF.update({
        where: { id: input.pdfId },
        data: {
          markerMetadata: {
            ...currentMetadata,
            extractionTokensUsed: extractionResult.tokensUsed,
            itemsExtracted: saveResult.saved,
            extractionErrors: saveResult.errors.length,
            lastExtractionAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        message: `Successfully extracted ${saveResult.saved} items`,
        itemsExtracted: saveResult.saved,
        tokensUsed: extractionResult.tokensUsed,
        errors: saveResult.errors,
      };
    }),
});
