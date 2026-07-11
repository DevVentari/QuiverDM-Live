import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('saveTrack', () => {
  it('writes under STORAGE_DIR and rejects traversal', async () => {
    process.env.STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-storage-'));
    const { saveTrack } = await import('@/lib/storage');
    const written = await saveTrack('session-recordings/s1/g1/track.wav', Buffer.from('abc'));
    expect(fs.readFileSync(written, 'utf8')).toBe('abc');
    await expect(saveTrack('../outside.wav', Buffer.from('x'))).rejects.toThrow(/storage key/i);
  });
});
