import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { homebrewPdfService } from '../services/homebrew-pdf.service';
import { usageService } from '../services/usage.service';
import { prisma } from '@/lib/prisma';

export const homebrewPdfRouter = router({
  /**
   * Generate a presigned R2 upload URL for direct browser-to-R2 upload.
   * Bypasses Vercel's 4.5MB serverless body limit.
   * In local storage mode, returns null and the client falls back to the server-proxied route.
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        fileSize: z.number().max(50 * 1024 * 1024),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (process.env.STORAGE_MODE !== 'r2') {
        return { presignedUrl: null, r2Key: null, r2Url: null };
      }

      const canUpload = await usageService.canUploadPdf(ctx.session.user.id);
      if (!canUpload) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Monthly PDF upload limit reached' });
      }

      const { getPresignedUploadUrl } = await import('@/lib/storage/r2');
      const timestamp = Date.now();
      const sanitized = input.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const r2Key = `homebrew-pdfs/${ctx.session.user.id}/${timestamp}-${sanitized}`;
      const presignedUrl = await getPresignedUploadUrl(r2Key, 'application/pdf', 600);
      const r2Url = `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Key}`;

      return { presignedUrl, r2Key, r2Url };
    }),

  /**
   * Create a PDF record after file has been uploaded to R2
   * Automatically queues the PDF for processing
   */
  createPDF: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        fileSize: z.number(),
        mimeType: z.string().default('application/pdf'),
        r2Url: z.string(),
        r2Key: z.string(),
        campaignId: z.string().optional(),
        useLLM: z.boolean().default(false),
        llmProvider: z.enum(['gemini', 'anthropic', 'openai']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await usageService.incrementPdfUploads(ctx.session.user.id);
      return homebrewPdfService.createPDF(ctx.session.user.id, input);
    }),

  /**
   * Process a PDF to markdown using Marker (via job queue)
   */
  processPDF: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        llmProvider: z.enum(['gemini', 'anthropic', 'openai']).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      homebrewPdfService.processPDF(input.pdfId, ctx.session.user.id, input.llmProvider)
    ),

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
    .query(({ input, ctx }) =>
      homebrewPdfService.getPDFs(ctx.session.user.id, input)
    ),

  /**
   * Get a single PDF with markdown content
   */
  getPDF: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(({ input, ctx }) =>
      homebrewPdfService.getPDF(input.pdfId, ctx.session.user.id)
    ),

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
    .mutation(({ input, ctx }) =>
      homebrewPdfService.toggleLLMMode(input.pdfId, ctx.session.user.id, input.useLLM)
    ),

  /**
   * Delete a PDF (removes from R2 and database)
   */
  deletePDF: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(({ input, ctx }) =>
      homebrewPdfService.deletePDF(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Get PDF statistics for the user
   */
  getStats: protectedProcedure
    .input(z.object({ campaignId: z.string().optional() }))
    .query(({ input, ctx }) =>
      homebrewPdfService.getStats(ctx.session.user.id, input.campaignId)
    ),

  /**
   * Get job status from queue
   */
  getJobStatus: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(({ input, ctx }) =>
      homebrewPdfService.getJobStatus(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Cancel a processing job
   */
  cancelJob: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(({ input, ctx }) =>
      homebrewPdfService.cancelJob(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Get queue statistics (admin/debug)
   */
  getQueueStats: protectedProcedure.query(() => homebrewPdfService.getQueueStats()),

  /**
   * Get a presigned URL for viewing a PDF
   */
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        expiresIn: z.number().min(60).max(86400).default(3600),
      })
    )
    .query(({ input, ctx }) =>
      homebrewPdfService.getPresignedUrl(input.pdfId, ctx.session.user.id, input.expiresIn)
    ),

  /**
   * Extract content from processed PDF markdown
   */
  extractContent: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .mutation(({ input, ctx }) =>
      homebrewPdfService.extractContent(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Get extracted homebrew content linked to a specific PDF
   */
  getExtractedContent: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input, ctx }) => {
      const pdf = await prisma.homebrewPDF.findFirst({
        where: { id: input.pdfId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!pdf) return [];
      return prisma.homebrewContent.findMany({
        where: { sourcePdfId: input.pdfId, userId: ctx.session.user.id },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
