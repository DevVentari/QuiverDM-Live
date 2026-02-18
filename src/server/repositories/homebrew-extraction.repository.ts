/**
 * Homebrew Extraction Repository
 *
 * Data access layer for content extraction operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';
import type { PrismaClient, Prisma } from '@prisma/client';

// Type mapping from AI extraction types to database types
const TYPE_MAP: Record<string, string> = {
  magic_item: 'item',
  spell: 'spell',
  creature: 'creature',
  feat: 'feat',
  race: 'race',
  background: 'background',
  class_feature: 'subclass',
};

export interface ExtractedContentItem {
  type: string;
  name: string;
  data: Record<string, unknown>;
}

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

interface ExtractedImageRef {
  url: string;
  pageNumber: number;
}

function matchImagesToItem(
  itemData: Record<string, unknown>,
  images: ExtractedImageRef[]
): { imageMetadata: ExtractedImageRef[] | null; extractionPageNumber: number | null } {
  if (images.length === 0) return { imageMetadata: null, extractionPageNumber: null };

  const pageRaw = itemData.page ?? itemData.pageNumber ?? itemData.page_number;
  const page = typeof pageRaw === 'number' ? pageRaw : typeof pageRaw === 'string' ? parseInt(pageRaw, 10) : NaN;

  if (!Number.isFinite(page) || page <= 0) return { imageMetadata: null, extractionPageNumber: null };

  const matched = images.filter((img) => img.pageNumber === page || img.pageNumber === page - 1);
  return {
    imageMetadata: matched.length > 0 ? matched : null,
    extractionPageNumber: page,
  };
}

/**
 * Save extracted content with deduplication and transactional writes.
 * Upserts items: if content with same name+type+userId+sourceType exists, update it.
 * Otherwise create new. All operations run in a single transaction.
 */
export async function saveExtractedContent(
  items: ExtractedContentItem[],
  userId: string,
  pdfId: string,
  campaignId?: string | null,
  db?: PrismaClient,
  extractedImages?: ExtractedImageRef[]
): Promise<{ saved: number; errors: string[] }> {
  const client = db || prisma;
  const errors: string[] = [];
  let saved = 0;

  if (items.length === 0) {
    return { saved: 0, errors: [] };
  }

  const images = extractedImages ?? [];

  try {
    await client.$transaction(async (tx) => {
      for (const item of items) {
        try {
          const contentType = TYPE_MAP[item.type] || item.type;
          const searchText = `${item.name} ${JSON.stringify(item.data)}`.toLowerCase();

          const itemData = item.data as Prisma.InputJsonValue;
          const { imageMetadata, extractionPageNumber } = matchImagesToItem(item.data, images);

          // Check for existing content (deduplication)
          const existing = await tx.homebrewContent.findFirst({
            where: {
              userId,
              name: item.name,
              type: contentType,
              sourceType: 'pdf_extraction',
            },
          });

          let content;
          if (existing) {
            // Update existing record
            content = await tx.homebrewContent.update({
              where: { id: existing.id },
              data: {
                data: itemData,
                tags: [item.type, 'extracted', 'ai-generated'],
                searchText,
                sourcePdfId: pdfId,
                ...(imageMetadata !== null && { imageMetadata: imageMetadata as unknown as Prisma.InputJsonValue }),
                ...(extractionPageNumber !== null && { extractionPageNumber }),
              },
            });
            console.log(`[Extraction] Updated existing: ${item.name} (${contentType})`);
          } else {
            // Create new record
            content = await tx.homebrewContent.create({
              data: {
                userId,
                type: contentType,
                name: item.name,
                data: itemData,
                sourceType: 'pdf_extraction',
                sourcePdfId: pdfId,
                tags: [item.type, 'extracted', 'ai-generated'],
                searchText,
                ...(imageMetadata !== null && { imageMetadata: imageMetadata as unknown as Prisma.InputJsonValue }),
                ...(extractionPageNumber !== null && { extractionPageNumber }),
              },
            });
            console.log(`[Extraction] Saved new: ${item.name} (${contentType})`);
          }

          // Link to campaign if provided (upsert to avoid duplicates)
          if (campaignId) {
            const existingLink = await tx.campaignHomebrewContent.findFirst({
              where: {
                campaignId,
                homebrewId: content.id,
              },
            });

            if (!existingLink) {
              await tx.campaignHomebrewContent.create({
                data: {
                  campaignId,
                  homebrewId: content.id,
                },
              });
            }
          }

          saved++;
        } catch (error) {
          const errorMsg = `Failed to save ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[Extraction] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    });
  } catch (error) {
    const errorMsg = `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[Extraction] ${errorMsg}`);
    errors.push(errorMsg);
    saved = 0;
  }

  return { saved, errors };
}

// Export all functions as a repository object
export const homebrewExtractionRepository = {
  findPdfByIdAndUser,
  createExtractedContent,
  createManyExtractedContent,
  saveExtractedContent,
};
