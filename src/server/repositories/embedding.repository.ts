import { prisma } from '@/lib/prisma';

export interface EmbeddedChunkInput {
  text: string;
  index: number;
  vector: number[];
}

/**
 * Upsert vector chunks for a single entity into the Embedding table.
 * Uses raw SQL so this repository works even if Prisma vector field support is limited.
 */
export async function upsertEmbeddings(
  entityId: string,
  entityType: string,
  chunks: EmbeddedChunkInput[],
  metadata: Record<string, unknown> = {},
  campaignId?: string
): Promise<void> {
  if (chunks.length === 0) return;

  await Promise.all(
    chunks.map(async (chunk) => {
      const vectorLiteral = `[${chunk.vector.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "Embedding" (
            "entityId",
            "entityType",
            "chunkIndex",
            "chunkText",
            "vector",
            "metadata",
            "campaignId",
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, $7, NOW(), NOW())
          ON CONFLICT ("entityId", "entityType", "chunkIndex")
          DO UPDATE SET
            "chunkText" = EXCLUDED."chunkText",
            "vector" = EXCLUDED."vector",
            "metadata" = EXCLUDED."metadata",
            "campaignId" = EXCLUDED."campaignId",
            "updatedAt" = NOW()
        `,
        entityId,
        entityType,
        chunk.index,
        chunk.text,
        vectorLiteral,
        JSON.stringify(metadata),
        campaignId ?? null
      );
    })
  );
}
