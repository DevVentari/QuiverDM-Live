/**
 * tRPC Router for Homebrew Content Extraction
 *
 * Endpoints for extracting structured D&D content from processed PDFs
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { parseMarkdown, getSectionsByType, generateSummary } from '@/lib/markdown-parser';
import { extractBatch, testOllama } from '@/lib/ollama-extraction';
import { extractContent, type ExtractionProvider } from '@/lib/ai-extraction';
import { TRPCError } from '@trpc/server';

export const homebrewExtractionRouter = router({
  /**
   * Test Ollama connectivity and model availability
   */
  testOllama: protectedProcedure
    .input(z.object({
      model: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const result = await testOllama(input?.model);
      return result;
    }),

  /**
   * Parse markdown from a PDF and return section breakdown
   */
  parseMarkdown: protectedProcedure
    .input(z.object({
      pdfId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const pdf = await ctx.prisma.homebrewPDF.findUnique({
        where: {
          id: input.pdfId,
          userId: ctx.session.user.id,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      if (pdf.processingStatus !== 'completed' || !pdf.markdownContent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF has not been processed yet',
        });
      }

      const parsed = parseMarkdown(pdf.markdownContent);
      const summary = generateSummary(parsed);

      return {
        summary,
        metadata: parsed.metadata,
        sections: parsed.sections.map(section => ({
          type: section.type,
          title: section.title,
          level: section.level,
          hasSubsections: (section.subsections?.length || 0) > 0,
        })),
      };
    }),

  /**
   * Extract content from specific sections of a PDF
   */
  extractSections: protectedProcedure
    .input(z.object({
      pdfId: z.string(),
      sectionTypes: z.array(z.enum(['spell', 'item', 'monster', 'class_feature', 'feat', 'race', 'background'])).optional(),
      limit: z.number().int().positive().max(100).optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pdf = await ctx.prisma.homebrewPDF.findUnique({
        where: {
          id: input.pdfId,
          userId: ctx.session.user.id,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      if (pdf.processingStatus !== 'completed' || !pdf.markdownContent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF has not been processed yet',
        });
      }

      // Parse markdown
      const parsed = parseMarkdown(pdf.markdownContent);

      // Get sections to extract
      let sectionsToExtract = parsed.sections;

      if (input.sectionTypes && input.sectionTypes.length > 0) {
        // Filter by requested types
        sectionsToExtract = input.sectionTypes.flatMap(type =>
          getSectionsByType(parsed.sections, type)
        );
      }

      // Apply limit
      if (input.limit) {
        sectionsToExtract = sectionsToExtract.slice(0, input.limit);
      }

      // Extract with Ollama
      const result = await extractBatch(sectionsToExtract, {
        model: input.model,
        batchSize: 3,
      });

      // Save extracted content to database
      const savedItems = await Promise.all(
        result.items.map(async (item) => {
          const data = item.data as any;
          return ctx.prisma.homebrewContent.create({
            data: {
              userId: ctx.session.user.id,
              type: item.type,
              name: data.name || 'Unnamed',
              data: item.data as any,
              sourceType: 'pdf_extraction',
              searchText: JSON.stringify(item.data).toLowerCase(),
            },
          });
        })
      );

      return {
        success: result.success,
        extractedCount: result.items.length,
        failedCount: result.errors.length,
        savedItems: savedItems.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
        })),
        errors: result.errors,
        metadata: result.metadata,
      };
    }),

  /**
   * Get extraction status and statistics for a PDF
   */
  getExtractionStats: protectedProcedure
    .input(z.object({
      pdfId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const pdf = await ctx.prisma.homebrewPDF.findUnique({
        where: {
          id: input.pdfId,
          userId: ctx.session.user.id,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      // Count extracted content from this PDF
      // Note: We'd need to track PDF source in HomebrewContent to make this accurate
      // For now, just return parsing stats
      if (pdf.processingStatus !== 'completed' || !pdf.markdownContent) {
        return {
          canExtract: false,
          reason: 'PDF not processed yet',
        };
      }

      const parsed = parseMarkdown(pdf.markdownContent);

      return {
        canExtract: true,
        metadata: parsed.metadata,
        totalSections: parsed.metadata.totalSections,
      };
    }),

  /**
   * Batch extract all content from a PDF
   */
  extractAllContent: protectedProcedure
    .input(z.object({
      pdfId: z.string(),
      model: z.string().optional(),
      skipUnknown: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const pdf = await ctx.prisma.homebrewPDF.findUnique({
        where: {
          id: input.pdfId,
          userId: ctx.session.user.id,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      if (pdf.processingStatus !== 'completed' || !pdf.markdownContent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF has not been processed yet',
        });
      }

      // Parse markdown
      const parsed = parseMarkdown(pdf.markdownContent);

      // Filter sections (skip 'unknown' if requested)
      let sectionsToExtract = parsed.sections;
      if (input.skipUnknown) {
        sectionsToExtract = sectionsToExtract.filter(s => s.type !== 'unknown');
      }

      console.log(`[Extraction] Extracting ${sectionsToExtract.length} sections from ${pdf.filename}`);

      // Extract with Ollama
      const result = await extractBatch(sectionsToExtract, {
        model: input.model,
        batchSize: 3,
      });

      // Save extracted content to database
      const savedItems = await Promise.all(
        result.items.map(async (item) => {
          const data = item.data as any;
          return ctx.prisma.homebrewContent.create({
            data: {
              userId: ctx.session.user.id,
              type: item.type,
              name: data.name || 'Unnamed',
              data: item.data as any,
              sourceType: 'pdf_extraction',
              searchText: JSON.stringify(item.data).toLowerCase(),
            },
          });
        })
      );

      console.log(`[Extraction] Saved ${savedItems.length} items to database`);

      return {
        success: result.success,
        extractedCount: result.items.length,
        failedCount: result.errors.length,
        savedItems: savedItems.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
        })),
        errors: result.errors,
        metadata: result.metadata,
      };
    }),

  /**
   * Extract content using cloud AI providers (Gemini, Anthropic, OpenAI)
   * This is the recommended extraction method - cheaper and faster than local Ollama
   */
  extractWithProvider: protectedProcedure
    .input(z.object({
      pdfId: z.string(),
      provider: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
    }))
    .mutation(async ({ ctx, input }) => {
      const pdf = await ctx.prisma.homebrewPDF.findUnique({
        where: {
          id: input.pdfId,
          userId: ctx.session.user.id,
        },
      });

      if (!pdf) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PDF not found',
        });
      }

      if (pdf.processingStatus !== 'completed' || !pdf.markdownContent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF has not been processed yet',
        });
      }

      console.log(`[Extraction] Extracting content from ${pdf.filename} using ${input.provider}`);

      // Extract with cloud AI provider
      const result = await extractContent(pdf.markdownContent, input.provider as ExtractionProvider);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Extraction failed: ${result.error}`,
        });
      }

      // Map AI extraction types to database types
      const typeMapping: Record<string, string> = {
        'magic_item': 'item',
        'spell': 'spell',
        'creature': 'creature',
        'feat': 'feat',
        'race': 'race',
        'background': 'background',
        'class_feature': 'subclass',
      };

      // Save extracted content to database
      const savedItems = await Promise.all(
        result.items.map(async (item) => {
          const mappedType = typeMapping[item.type] || item.type;
          return ctx.prisma.homebrewContent.create({
            data: {
              userId: ctx.session.user.id,
              type: mappedType,
              name: item.name,
              data: item.data as any,
              sourceType: 'pdf_extraction',
              searchText: JSON.stringify(item.data).toLowerCase(),
            },
          });
        })
      );

      console.log(`[Extraction] Saved ${savedItems.length} items to database using ${input.provider}`);

      return {
        success: true,
        extractedCount: result.items.length,
        savedItems: savedItems.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
        })),
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        error: result.error,
      };
    }),
});
