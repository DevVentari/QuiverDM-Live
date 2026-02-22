/**
 * Multi-provider text embedding generation.
 * Primary: Ollama nomic-embed-text (768 dimensions)
 * Fallback: OpenAI text-embedding-3-small (768 dimensions)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';

function isValidEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === 'number');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Cannot generate embedding for empty text');
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: normalizedText }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      const data = await response.json();
      const embedding = data.embeddings?.[0] ?? data.embedding;
      if (isValidEmbedding(embedding)) {
        return embedding;
      }
    }
  } catch {
    // Fall through to OpenAI provider
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('No embedding provider available (Ollama unavailable and OPENAI_API_KEY missing)');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: normalizedText,
      dimensions: 768,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!isValidEmbedding(embedding)) {
    throw new Error('OpenAI embeddings response was missing a valid embedding vector');
  }

  return embedding;
}

/** Split text into overlapping chunks for semantic indexing. */
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
    if (chunk.length > 50) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
