import { describe, it, expect } from 'vitest';
import { encrypt as mainEncrypt, decrypt as mainDecrypt } from '@/lib/encryption';
import { encrypt, decrypt, maskKey } from '../../../packages/shared/src/encryption';

describe('shared encryption', () => {
  it('round-trips', () => {
    expect(decrypt(encrypt('CobaltSession=abc123'))).toBe('CobaltSession=abc123');
  });

  it('is byte-compatible with the main app implementation (both directions)', () => {
    expect(mainDecrypt(encrypt('cross-check'))).toBe('cross-check');
    expect(decrypt(mainEncrypt('cross-check'))).toBe('cross-check');
  });

  it('returns empty string on garbage payloads instead of throwing', () => {
    expect(decrypt('not-a-payload')).toBe('');
    expect(decrypt('deadbeef:zzzz')).toBe('');
  });

  it('masks to the last four characters', () => {
    expect(maskKey('abcdef1234')).toBe('…1234');
    expect(maskKey('ab')).toBe('••••••••');
  });
});
