/**
 * tRPC Router for Homebrew Content Extraction
 *
 * Endpoints for extracting structured D&D content from processed PDFs
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { homebrewExtractionService } from '../services/homebrew-extraction.service';

export const homebrewExtractionRouter = router({
  /**
   * Test Ollama connectivity and model availability
   */
  testOllama: protectedProcedure
    .input(z.object({ model: z.string().optional() }).optional())
    .query(({ input }) => homebrewExtractionService.testOllama(input?.model)),

  /**
   * Parse markdown from a PDF and return section breakdown
   */
  parseMarkdown: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(({ ctx, input }) =>
      homebrewExtractionService.parseMarkdown(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Extract content from specific sections of a PDF
   */
  extractSections: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        sectionTypes: z
          .array(
            z.enum([
              'spell',
              'item',
              'monster',
              'class_feature',
              'feat',
              'race',
              'background',
            ])
          )
          .optional(),
        limit: z.number().int().positive().max(100).optional(),
        model: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { pdfId, ...options } = input;
      return homebrewExtractionService.extractSections(
        pdfId,
        ctx.session.user.id,
        options
      );
    }),

  /**
   * Get extraction status and statistics for a PDF
   */
  getExtractionStats: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(({ ctx, input }) =>
      homebrewExtractionService.getExtractionStats(input.pdfId, ctx.session.user.id)
    ),

  /**
   * Batch extract all content from a PDF
   */
  extractAllContent: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        model: z.string().optional(),
        skipUnknown: z.boolean().optional().default(true),
      })
    )
    .mutation(({ ctx, input }) => {
      const { pdfId, ...options } = input;
      return homebrewExtractionService.extractAllContent(
        pdfId,
        ctx.session.user.id,
        options
      );
    }),

  /**
   * Extract content using cloud AI providers (Gemini, Anthropic, OpenAI)
   */
  extractWithProvider: protectedProcedure
    .input(
      z.object({
        pdfId: z.string(),
        provider: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
      })
    )
    .mutation(({ ctx, input }) =>
      homebrewExtractionService.extractWithProvider(
        input.pdfId,
        ctx.session.user.id,
        input.provider
      )
    ),
});
