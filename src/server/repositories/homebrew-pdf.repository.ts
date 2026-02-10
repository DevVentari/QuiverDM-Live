/**
 * Homebrew PDF Repository
 *
 * Data access layer for PDF processing operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';

// =============================================================================
// Types
// =============================================================================

export interface CreatePDFInput {
  userId: string;
  campaignId?: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  r2Url: string;
  useLLM: boolean;
}

export interface PDFQueryOptions {
  userId: string;
  campaignId?: string;
  limit: number;
  cursor?: string;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Create a new PDF record
 */
export async function create(input: CreatePDFInput) {
  return prisma.homebrewPDF.create({
    data: {
      userId: input.userId,
      campaignId: input.campaignId,
      filename: input.filename,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      r2Url: input.r2Url,
      useLLM: input.useLLM,
      processingStatus: 'pending',
    },
  });
}

/**
 * Find a PDF by ID (with ownership check)
 */
export async function findByIdAndUser(pdfId: string, userId: string) {
  return prisma.homebrewPDF.findFirst({
    where: {
      id: pdfId,
      userId,
    },
  });
}

/**
 * Find a PDF by ID with campaign info
 */
export async function findByIdWithCampaign(pdfId: string, userId: string) {
  return prisma.homebrewPDF.findFirst({
    where: {
      id: pdfId,
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
}

/**
 * Find PDFs for a user with pagination
 */
export async function findByUser(options: PDFQueryOptions) {
  const where: any = { userId: options.userId };

  if (options.campaignId) {
    where.campaignId = options.campaignId;
  }

  return prisma.homebrewPDF.findMany({
    where,
    take: options.limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Update a PDF record
 */
export async function update(
  pdfId: string,
  data: {
    useLLM?: boolean;
    processingStatus?: string;
    markerProcessed?: boolean;
    markdownContent?: string | null;
    markerMetadata?: any;
    errorMessage?: string | null;
    processingEndedAt?: Date;
  }
) {
  return prisma.homebrewPDF.update({
    where: { id: pdfId },
    data,
  });
}

/**
 * Delete a PDF record
 */
export async function remove(pdfId: string) {
  return prisma.homebrewPDF.delete({
    where: { id: pdfId },
  });
}

/**
 * Get PDF statistics for a user
 */
export async function getStats(userId: string, campaignId?: string) {
  const where: any = { userId };
  if (campaignId) {
    where.campaignId = campaignId;
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
}

// Export all functions as a repository object
export const homebrewPdfRepository = {
  create,
  findByIdAndUser,
  findByIdWithCampaign,
  findByUser,
  update,
  remove,
  getStats,
};
