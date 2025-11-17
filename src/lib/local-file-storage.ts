/**
 * Local File Storage (Development Fallback)
 *
 * Used when R2 is not configured. Stores files locally in the project directory.
 * NOT for production use - use R2 in production.
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const STORAGE_DIR = path.join(process.cwd(), 'local-storage');

/**
 * Initialize local storage directory
 */
async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    console.log(`[Local Storage] Created directory: ${STORAGE_DIR}`);
  }
}

/**
 * Upload a file to local storage
 */
export async function uploadToLocalStorage(params: {
  key: string;
  body: Buffer | Uint8Array | Blob;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  await ensureStorageDir();

  const filePath = path.join(STORAGE_DIR, params.key);
  const fileDir = path.dirname(filePath);

  // Create subdirectories if needed
  if (!existsSync(fileDir)) {
    await fs.mkdir(fileDir, { recursive: true });
  }

  // Convert Blob to Buffer if needed
  let buffer: Buffer;
  if (params.body instanceof Blob) {
    const arrayBuffer = await params.body.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if (params.body instanceof Uint8Array) {
    buffer = Buffer.from(params.body);
  } else {
    buffer = params.body;
  }

  // Write file
  await fs.writeFile(filePath, buffer);

  // Store metadata if provided
  if (params.metadata) {
    const metadataPath = `${filePath}.metadata.json`;
    await fs.writeFile(metadataPath, JSON.stringify({
      contentType: params.contentType,
      metadata: params.metadata,
      uploadedAt: new Date().toISOString(),
    }, null, 2));
  }

  console.log(`[Local Storage] Uploaded: ${params.key}`);

  // Return an API URL that browsers can access
  return `/api/storage/${params.key}`;
}

/**
 * Download a file from local storage
 */
export async function downloadFromLocalStorage(key: string): Promise<Buffer> {
  // Remove any URL prefix if present
  const cleanKey = key.replace(/^\/api\/storage\//, '').replace('local://', '');
  const filePath = path.join(STORAGE_DIR, cleanKey);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${key}`);
  }

  const buffer = await fs.readFile(filePath);
  console.log(`[Local Storage] Downloaded: ${cleanKey}`);

  return buffer;
}

/**
 * Get a signed URL for local storage (just returns the local path)
 */
export async function getLocalStorageSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  // Remove any URL prefix if present
  const cleanKey = key.replace(/^\/api\/storage\//, '').replace('local://', '');
  const filePath = path.join(STORAGE_DIR, cleanKey);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${key}`);
  }

  // Return an API URL that browsers can access
  return `/api/storage/${cleanKey}`;
}

/**
 * Delete a file from local storage
 */
export async function deleteFromLocalStorage(key: string): Promise<void> {
  // Remove any URL prefix if present
  const cleanKey = key.replace(/^\/api\/storage\//, '').replace('local://', '');
  const filePath = path.join(STORAGE_DIR, cleanKey);

  if (existsSync(filePath)) {
    await fs.unlink(filePath);
    console.log(`[Local Storage] Deleted: ${cleanKey}`);

    // Also delete metadata if it exists
    const metadataPath = `${filePath}.metadata.json`;
    if (existsSync(metadataPath)) {
      await fs.unlink(metadataPath);
    }
  }
}

/**
 * Check if local storage is being used
 */
export function isUsingLocalStorage(): boolean {
  return !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID;
}

/**
 * Get storage info
 */
export function getStorageInfo() {
  const isLocal = isUsingLocalStorage();
  return {
    type: isLocal ? 'local' : 'r2',
    location: isLocal ? STORAGE_DIR : 'Cloudflare R2',
    configured: !isLocal,
  };
}
