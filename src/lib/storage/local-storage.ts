import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

// Local storage directory (in project root)
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const HOMEBREW_DIR = path.join(STORAGE_DIR, 'homebrew-pdfs');
const PAGES_DIR = path.join(STORAGE_DIR, 'homebrew-pages');

/**
 * Initialize local storage directories
 */
export async function initializeLocalStorage() {
  await fs.mkdir(HOMEBREW_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });
  console.log('✓ Local storage initialized');
}

/**
 * Upload a file to local storage
 */
export async function uploadToLocal(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  const filePath = path.join(STORAGE_DIR, params.key);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Write file
  const buffer = Buffer.isBuffer(params.body)
    ? params.body
    : Buffer.from(params.body);
  await fs.writeFile(filePath, buffer);

  // Write metadata if provided
  if (params.metadata) {
    const metadataPath = `${filePath}.meta.json`;
    await fs.writeFile(metadataPath, JSON.stringify(params.metadata, null, 2));
  }

  // Return local URL (will be served by Next.js API route)
  return `/api/storage/${params.key}`;
}

/**
 * Delete a file from local storage
 */
export async function deleteFromLocal(key: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, key);
  try {
    await fs.unlink(filePath);
    // Also delete metadata if exists
    try {
      await fs.unlink(`${filePath}.meta.json`);
    } catch {
      // Ignore if metadata doesn't exist
    }
  } catch (error) {
    console.error(`Failed to delete file: ${key}`, error);
  }
}

/**
 * Get file from local storage
 */
export async function getFromLocal(key: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_DIR, key);
  return await fs.readFile(filePath);
}

/**
 * Check if file exists in local storage
 */
export async function existsInLocal(key: string): Promise<boolean> {
  const filePath = path.join(STORAGE_DIR, key);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a local URL for a file
 * In local mode, files are served via /api/storage
 */
export function getLocalUrl(key: string): string {
  return `/api/storage/${key}`;
}

/**
 * Generate download URL (same as local URL for local storage)
 */
export async function getLocalDownloadUrl(key: string): Promise<string> {
  return getLocalUrl(key);
}

/**
 * Generate a unique file key for local storage
 */
export function generateLocalFileKey(
  userId: string,
  campaignId: string,
  filename: string,
  prefix: string = 'files'
): string {
  const timestamp = Date.now();
  const randomString = randomBytes(4).toString('hex');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  return `${prefix}/${userId}/${campaignId}/${timestamp}-${randomString}-${sanitizedFilename}`;
}

/**
 * Extract key from local URL
 */
export function extractKeyFromLocalUrl(url: string): string {
  // Handle full URLs (http://localhost:3007/api/storage/...)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\/api\/storage\//, '');
  }
  // Handle relative URLs (/api/storage/...)
  return url.replace(/^\/api\/storage\//, '');
}

/**
 * Get absolute file path from key
 */
export function getAbsolutePathFromKey(key: string): string {
  return path.join(STORAGE_DIR, key);
}

// Initialize storage on module load (server-side only)
if (typeof window === 'undefined') {
  initializeLocalStorage().catch(console.error);
}
