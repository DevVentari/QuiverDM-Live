import { generateEmbedding } from '@/lib/ai/embeddings';
import { chatWithOllama } from '@/lib/ai/ollama';
import { callGemini } from '@/lib/ai/gemini';
import { redis } from '@/lib/queue/queue';
import { prisma } from '@/lib/prisma';
import { indexRulesSource, removeRulesIndex } from './rules-indexing.service';

interface RulesLookupResult {
  answer: string;
  sources: Array<{ chunkText: string; source: string }>;
}

interface RulesSearchRow {
  entityId: string;
  chunkText: string;
  metadata: unknown;
  score: number;
}

function getSourceFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') {
    return 'Unknown source';
  }

  const value = (metadata as { source?: unknown }).source;
  return typeof value === 'string' && value.length > 0 ? value : 'Unknown source';
}

export class RulesService {
  async lookup(question: string, limit = 5): Promise<RulesLookupResult> {
    const normalizedQuestion = question.trim();
    const cacheKey = `rules:${Buffer.from(normalizedQuestion).toString('base64url').slice(0, 64)}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as RulesLookupResult;
      }
    }

    const queryVector = await generateEmbedding(normalizedQuestion);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const results = await prisma.$queryRawUnsafe<RulesSearchRow[]>(
      `
        SELECT
          "entityId",
          "chunkText",
          "metadata",
          1 - (vector <=> $1::vector) AS score
        FROM "Embedding"
        WHERE "entityType" = 'rules'
        ORDER BY vector <=> $1::vector
        LIMIT $2
      `,
      vectorLiteral,
      limit
    );

    if (results.length === 0) {
      return { answer: 'No relevant rules found for that question.', sources: [] };
    }

    const context = results.map((row) => row.chunkText).join('\n\n---\n\n');
    let answer: string;
    try {
      answer = await chatWithOllama(
        [
          {
            role: 'system',
            content:
              'You are a D&D 5e rules expert. Answer using only the provided rules text. Be concise (2-4 sentences). If the answer is not in the provided text, explicitly say so.',
          },
          {
            role: 'user',
            content: `Rules text:\n${context}\n\nQuestion: ${normalizedQuestion}`,
          },
        ],
        { temperature: 0.1 }
      );
    } catch {
      // Ollama unavailable — fall back to Gemini
      try {
        answer = await callGemini(
          `You are a D&D 5e rules expert. Answer using only the provided rules text. Be concise (2-4 sentences). If the answer is not in the provided text, explicitly say so.\n\nRules text:\n${context}\n\nQuestion: ${normalizedQuestion}`
        );
      } catch {
        answer = 'Rules AI is temporarily unavailable. Please try again later.';
      }
    }

    const payload: RulesLookupResult = {
      answer,
      sources: results.map((row) => ({
        chunkText: row.chunkText.slice(0, 200),
        source: getSourceFromMetadata(row.metadata),
      })),
    };

    if (redis) {
      await redis.setex(cacheKey, 600, JSON.stringify(payload));
    }

    return payload;
  }

  async listSources() {
    return prisma.homebrewPDF.findMany({
      where: { isRulesSource: true },
      select: { id: true, filename: true, indexedAt: true },
      orderBy: { indexedAt: 'desc' },
    });
  }

  async listAllPdfs() {
    return prisma.homebrewPDF.findMany({
      select: {
        id: true,
        filename: true,
        isRulesSource: true,
        indexedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async indexSource(pdfId: string) {
    await indexRulesSource(pdfId);
  }

  async removeSource(pdfId: string) {
    await removeRulesIndex(pdfId);
  }
}

export const rulesService = new RulesService();
