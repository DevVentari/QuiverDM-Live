import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export type EmbeddingEntityType = 'transcript' | 'npc' | 'quest' | 'rules' | 'world_entity';

export async function upsertEmbeddings(
  entityId: string,
  entityType: EmbeddingEntityType,
  chunks: Array<{ text: string; index: number; vector: number[] }>,
  metadata: Record<string, unknown>,
  campaignId?: string
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "Embedding"
    WHERE "entityId" = ${entityId}
      AND "entityType" = ${entityType}
  `;

  for (const chunk of chunks) {
    const vectorStr = `[${chunk.vector.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Embedding" (
        id,
        "entityType",
        "entityId",
        "chunkText",
        "chunkIndex",
        vector,
        metadata,
        "campaignId",
        "createdAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::vector,
        $7::jsonb,
        $8,
        NOW()
      )
    `,
      randomUUID(),
      entityType,
      entityId,
      chunk.text,
      chunk.index,
      vectorStr,
      JSON.stringify(metadata),
      campaignId ?? null
    );
  }
}

export async function semanticSearch(
  queryVector: number[],
  campaignId: string,
  entityTypes: EmbeddingEntityType[],
  limit = 10
): Promise<Array<{ entityId: string; entityType: string; chunkText: string; metadata: unknown; score: number }>> {
  const vectorStr = `[${queryVector.join(',')}]`;
  const typeFilter = entityTypes.length > 0 ? entityTypes : ['transcript', 'npc', 'quest'];

  const results = await prisma.$queryRaw<Array<{
    entityId: string;
    entityType: string;
    chunkText: string;
    metadata: unknown;
    score: number | string;
  }>>(
    Prisma.sql`
      SELECT
        "entityId",
        "entityType",
        "chunkText",
        metadata,
        1 - (vector <=> ${vectorStr}::vector) AS score
      FROM "Embedding"
      WHERE "campaignId" = ${campaignId}
        AND "entityType" IN (${Prisma.join(typeFilter)})
      ORDER BY vector <=> ${vectorStr}::vector
      LIMIT ${limit}
    `
  );

  return results.map((row) => ({
    ...row,
    score: typeof row.score === 'number' ? row.score : Number.parseFloat(row.score as string),
  }));
}

export async function deleteEntityEmbeddings(entityId: string, entityType: EmbeddingEntityType) {
  return prisma.$executeRaw`
    DELETE FROM "Embedding"
    WHERE "entityId" = ${entityId}
      AND "entityType" = ${entityType}
  `;
}
