const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const DEFAULT_EMBEDDING_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';

/**
 * Split text into overlapping chunks for embedding.
 * Chunking is character-based to keep implementation lightweight and model-agnostic.
 */
export function chunkText(
  text: string,
  maxChunkLength = 1500,
  overlap = 150
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChunkLength) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChunkLength, normalized.length);

    if (end < normalized.length) {
      const lastBoundary = Math.max(
        normalized.lastIndexOf('\n\n', end),
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf(' ', end)
      );
      if (lastBoundary > start + Math.floor(maxChunkLength * 0.6)) {
        end = lastBoundary;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/**
 * Generate an embedding vector via Ollama's /api/embeddings endpoint.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding response was missing a valid vector');
  }

  return data.embedding;
}
