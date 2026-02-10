/**
 * Homebrew Extraction Repository
 *
 * Data access layer for content extraction operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Find a PDF by ID and user
 */
export async function findPdfByIdAndUser(pdfId: string, userId: string) {
  return prisma.homebrewPDF.findUnique({
    where: {
      id: pdfId,
      userId,
    },
  });
}

/**
 * Create homebrew content from extraction
 */
export async function createExtractedContent(data: {
  userId: string;
  type: string;
  name: string;
  data: any;
}) {
  return prisma.homebrewContent.create({
    data: {
      userId: data.userId,
      type: data.type,
      name: data.name,
      data: data.data,
      sourceType: 'pdf_extraction',
      searchText: JSON.stringify(data.data).toLowerCase(),
    },
  });
}

/**
 * Create multiple homebrew content items from extraction
 */
export async function createManyExtractedContent(
  items: Array<{
    userId: string;
    type: string;
    name: string;
    data: any;
  }>
) {
  return Promise.all(items.map((item) => createExtractedContent(item)));
}

// Export all functions as a repository object
export const homebrewExtractionRepository = {
  findPdfByIdAndUser,
  createExtractedContent,
  createManyExtractedContent,
};
