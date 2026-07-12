import { describe, it, expect } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { extractAudioFromZip, guessAudioMime } from '@/lib/zip';

async function buildZip(entries: Array<[name: string, content: string]>): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const [name, content] of entries) await writer.add(name, new TextReader(content));
  const blob = await writer.close();
  return new File([blob], 'craig.zip', { type: 'application/zip' });
}

describe('extractAudioFromZip', () => {
  it('keeps only audio entries and strips directory prefixes', async () => {
    const zip = await buildZip([
      ['craig-abc/1-alexdm.flac', 'AUDIO1'],
      ['craig-abc/2-jules_0.wav', 'AUDIO2'],
      ['craig-abc/info.txt', 'not audio'],
      ['craig-abc/raw.dat', 'not audio'],
    ]);
    const files = await extractAudioFromZip(zip);
    expect(files.map((f) => f.name).sort()).toEqual(['1-alexdm.flac', '2-jules_0.wav']);
    expect(files[0].type).toBe(guessAudioMime(files[0].name));
  });

  it('rejects garbage that is not a zip', async () => {
    const notAZip = new File([Buffer.from('this is not a zip archive')], 'fake.zip', { type: 'application/zip' });
    await expect(extractAudioFromZip(notAZip)).rejects.toThrow();
  });
});
