import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';

const AUDIO_RE = /\.(flac|wav|aac|m4a|mp3|ogg|opus|webm)$/i;

const MIME: Record<string, string> = {
  flac: 'audio/flac', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/opus', webm: 'audio/webm',
};

export function guessAudioMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'audio/wav';
}

/** Client-side: stream a Craig zip entry-by-entry; only audio entries become Files. */
export async function extractAudioFromZip(zipFile: File): Promise<File[]> {
  const reader = new ZipReader(new BlobReader(zipFile));
  const files: File[] = [];
  try {
    for (const entry of await reader.getEntries()) {
      if (entry.directory || !AUDIO_RE.test(entry.filename) || !entry.getData) continue;
      const blob = await entry.getData(new BlobWriter());
      const base = entry.filename.split('/').pop()!;
      files.push(new File([blob], base, { type: guessAudioMime(base) }));
    }
  } finally {
    await reader.close();
  }
  return files;
}
