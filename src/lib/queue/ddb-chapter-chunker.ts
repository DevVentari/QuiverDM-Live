export interface ProseChunk {
  text: string;
  index: number;
  charLength: number;
  estimatedTokens: number;
}

const TARGET_CHARS = 800;
const MAX_CHARS = 1200;
const OVERLAP_CHARS = 120;

/**
 * Split chapter prose into paragraph-aligned chunks for embedding.
 * Pack paragraphs greedily up to TARGET_CHARS; never exceed MAX_CHARS in
 * a single chunk. Apply OVERLAP_CHARS sliding overlap so cross-chunk
 * sentences keep at least one neighbour anchor.
 */
export function chunkChapterProse(prose: string): ProseChunk[] {
  const trimmed = prose.trim();
  if (trimmed.length === 0) return [];

  const paragraphs = trimmed
    .split(/\n{2,}|(?<=[.!?])\s{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [{ text: trimmed.slice(0, MAX_CHARS), index: 0, charLength: Math.min(trimmed.length, MAX_CHARS), estimatedTokens: Math.ceil(Math.min(trimmed.length, MAX_CHARS) / 4) }];
  }

  const chunks: string[] = [];
  let buf = '';

  function flush() {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = '';
  }

  for (const p of paragraphs) {
    if (p.length > MAX_CHARS) {
      // Single paragraph too long — hard-split on sentence boundaries
      flush();
      const sentences = p.split(/(?<=[.!?])\s+/);
      let sBuf = '';
      for (const s of sentences) {
        if (sBuf.length + s.length + 1 > TARGET_CHARS && sBuf.length > 0) {
          chunks.push(sBuf.trim());
          sBuf = '';
        }
        sBuf += (sBuf ? ' ' : '') + s;
      }
      if (sBuf.trim()) chunks.push(sBuf.trim());
      continue;
    }
    if (buf.length + p.length + 2 > TARGET_CHARS && buf.length > 0) {
      flush();
    }
    buf += (buf ? '\n\n' : '') + p;
  }
  flush();

  // Apply overlap: prepend tail of previous chunk to each subsequent chunk
  const overlapped: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      overlapped.push(chunks[i]);
    } else {
      const prevTail = chunks[i - 1].slice(-OVERLAP_CHARS);
      overlapped.push(`${prevTail}\n\n${chunks[i]}`.slice(0, MAX_CHARS));
    }
  }

  return overlapped.map((text, index) => ({
    text,
    index,
    charLength: text.length,
    estimatedTokens: Math.ceil(text.length / 4),
  }));
}
