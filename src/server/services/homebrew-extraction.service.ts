/**
 * Homebrew Extraction Service
 *
 * Business logic for extracting D&D content from processed PDFs.
 */

import { TRPCError } from '@trpc/server';
import { homebrewExtractionRepository } from '../repositories/homebrew-extraction.repository';
import {
  parseMarkdown,
  getSectionsByType,
  generateSummary,
} from '@/lib/markdown-parser';
import { extractBatch, testOllama } from '@/lib/ai/ollama-extraction';
import { extractContent, type ExtractionProvider } from '@/lib/ai/extraction';

// Type mapping from AI extraction types to database types
const TYPE_MAPPING: Record<string, string> = {
  magic_item: 'item',
  spell: 'spell',
  creature: 'creature',
  feat: 'feat',
  race: 'race',
  background: 'background',
  class_feature: 'subclass',
};

export class HomebrewExtractionService {
  /**
   * Test Ollama connectivity and model availability
   */
  async testOllama(model?: string) {
    return testOllama(model);
  }

  /**
   * Parse markdown from a PDF and return section breakdown
   */
  async parseMarkdown(pdfId: string, userId: string) {
    const pdf = await this.getValidatedPdf(pdfId, userId);

    const parsed = parseMarkdown(pdf.markdownContent!);
    const summary = generateSummary(parsed);

    return {
      summary,
      metadata: parsed.metadata,
      sections: parsed.sections.map((section) => ({
        type: section.type,
        title: section.title,
        level: section.level,
        hasSubsections: (section.subsections?.length || 0) > 0,
      })),
    };
  }

  /**
   * Extract content from specific sections of a PDF
   */
  async extractSections(
    pdfId: string,
    userId: string,
    options: {
      sectionTypes?: string[];
      limit?: number;
      model?: string;
    }
  ) {
    const pdf = await this.getValidatedPdf(pdfId, userId);

    const parsed = parseMarkdown(pdf.markdownContent!);
    let sectionsToExtract = parsed.sections;

    if (options.sectionTypes && options.sectionTypes.length > 0) {
      sectionsToExtract = options.sectionTypes.flatMap((type) =>
        getSectionsByType(parsed.sections, type as any)
      );
    }

    if (options.limit) {
      sectionsToExtract = sectionsToExtract.slice(0, options.limit);
    }

    const result = await extractBatch(sectionsToExtract, {
      model: options.model,
      batchSize: 3,
    });

    const savedItems = await homebrewExtractionRepository.createManyExtractedContent(
      result.items.map((item) => ({
        userId,
        type: item.type,
        name: (item.data as any).name || 'Unnamed',
        data: item.data,
      }))
    );

    return {
      success: result.success,
      extractedCount: result.items.length,
      failedCount: result.errors.length,
      savedItems: savedItems.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
      })),
      errors: result.errors,
      metadata: result.metadata,
    };
  }

  /**
   * Get extraction status and statistics for a PDF
   */
  async getExtractionStats(pdfId: string, userId: string) {
    const pdf = await homebrewExtractionRepository.findPdfByIdAndUser(pdfId, userId);

    if (!pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'PDF not found',
      });
    }

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
  }

  /**
   * Batch extract all content from a PDF
   */
  async extractAllContent(
    pdfId: string,
    userId: string,
    options: {
      model?: string;
      skipUnknown?: boolean;
    }
  ) {
    const pdf = await this.getValidatedPdf(pdfId, userId);

    const parsed = parseMarkdown(pdf.markdownContent!);
    let sectionsToExtract = parsed.sections;

    if (options.skipUnknown !== false) {
      sectionsToExtract = sectionsToExtract.filter((s) => s.type !== 'unknown');
    }

    console.log(
      `[Extraction] Extracting ${sectionsToExtract.length} sections from ${pdf.filename}`
    );

    const result = await extractBatch(sectionsToExtract, {
      model: options.model,
      batchSize: 3,
    });

    const savedItems = await homebrewExtractionRepository.createManyExtractedContent(
      result.items.map((item) => ({
        userId,
        type: item.type,
        name: (item.data as any).name || 'Unnamed',
        data: item.data,
      }))
    );

    console.log(`[Extraction] Saved ${savedItems.length} items to database`);

    return {
      success: result.success,
      extractedCount: result.items.length,
      failedCount: result.errors.length,
      savedItems: savedItems.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
      })),
      errors: result.errors,
      metadata: result.metadata,
    };
  }

  /**
   * Extract content using cloud AI providers
   */
  async extractWithProvider(
    pdfId: string,
    userId: string,
    provider: 'gemini' | 'anthropic' | 'openai' = 'gemini'
  ) {
    const pdf = await this.getValidatedPdf(pdfId, userId);

    console.log(
      `[Extraction] Extracting content from ${pdf.filename} using ${provider}`
    );

    const result = await extractContent(
      pdf.markdownContent!,
      provider as ExtractionProvider
    );

    if (!result.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Extraction failed: ${result.error}`,
      });
    }

    const savedItems = await homebrewExtractionRepository.createManyExtractedContent(
      result.items.map((item) => ({
        userId,
        type: TYPE_MAPPING[item.type] || item.type,
        name: item.name,
        data: item.data,
      }))
    );

    console.log(
      `[Extraction] Saved ${savedItems.length} items to database using ${provider}`
    );

    return {
      success: true,
      extractedCount: result.items.length,
      savedItems: savedItems.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
      })),
      provider: result.provider,
      tokensUsed: result.tokensUsed,
      error: result.error,
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private async getValidatedPdf(pdfId: string, userId: string) {
    const pdf = await homebrewExtractionRepository.findPdfByIdAndUser(pdfId, userId);

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

    return pdf;
  }
}

export const homebrewExtractionService = new HomebrewExtractionService();
