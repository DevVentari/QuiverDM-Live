import crypto from 'crypto';

/**
 * MUST stay byte-compatible with src/lib/encryption.ts in the main app:
 * aes-256-cbc, key = sha256(ENCRYPTION_KEY), payload "<ivHex>:<cipherHex>".
 * Both apps read/write the same encrypted UserSettings columns.
 */
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

/** Returns '' on any failure — callers treat empty as "not set". */
export function decrypt(payload: string): string {
  try {
    const [ivHex, dataHex] = payload.split(':');
    if (!ivHex || !dataHex) return '';
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskKey(key: string): string {
  return key.length > 4 ? `…${key.slice(-4)}` : '••••••••';
}
