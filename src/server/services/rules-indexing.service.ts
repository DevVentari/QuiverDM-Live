import { chunkText, generateEmbedding } from '@/lib/ai/embeddings';
import { prisma } from '@/lib/prisma';
import { upsertEmbeddings } from '@/server/repositories/embedding.repository';

/**
 * Index a PDF as a global rules source.
 * Uses markdownContent produced by the PDF processing pipeline.
 */
export async function indexRulesSource(pdfId: string): Promise<void> {
  const pdf = await prisma.homebrewPDF.findUnique({
    where: { id: pdfId },
    select: {
      id: true,
      filename: true,
      markdownContent: true,
    },
  });

  if (!pdf) {
    throw new Error(`PDF not found: ${pdfId}`);
  }

  const text = pdf.markdownContent?.trim();
  if (!text) {
    throw new Error(`PDF ${pdfId} has no extracted text. Process it first.`);
  }

  const chunks = chunkText(text, 1500, 150);
  if (chunks.length === 0) {
    throw new Error(`PDF ${pdfId} did not produce any indexable chunks.`);
  }

  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk, index) => ({
      text: chunk,
      index,
      vector: await generateEmbedding(chunk),
    }))
  );

  await upsertEmbeddings(
    pdfId,
    'rules',
    embeddedChunks,
    { source: pdf.filename, pdfId },
    undefined
  );

  await prisma.homebrewPDF.update({
    where: { id: pdfId },
    data: {
      isRulesSource: true,
      indexedAt: new Date(),
    },
  });

  console.log(`[rules] Indexed ${embeddedChunks.length} chunks from ${pdf.filename}`);
}

/**
 * Remove rules index for a PDF.
 */
export async function removeRulesIndex(pdfId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Embedding" WHERE "entityId" = $1 AND "entityType" = 'rules'`,
    pdfId
  );

  await prisma.homebrewPDF.update({
    where: { id: pdfId },
    data: {
      isRulesSource: false,
      indexedAt: null,
    },
  });
}
