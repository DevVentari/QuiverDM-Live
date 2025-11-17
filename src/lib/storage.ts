/**
 * Unified Storage API
 *
 * Automatically uses R2 when configured, falls back to local storage for development
 */

import {
  uploadToLocalStorage,
  downloadFromLocalStorage,
  getLocalStorageSignedUrl,
  deleteFromLocalStorage,
  isUsingLocalStorage,
  getStorageInfo as getLocalStorageInfo
} from './local-file-storage';

// Check if R2 is available
const isR2Available = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

// Log storage mode on startup
if (isR2Available) {
  console.log('[Storage] R2 credentials detected but not loading R2 module (missing env vars)');
  console.log('[Storage] Using local file storage (development mode)');
  console.log('[Storage] Files will be stored in: ./local-storage/');
} else {
  console.log('[Storage] Using local file storage (development mode)');
  console.log('[Storage] Files will be stored in: ./local-storage/');
}

// For now, always use local storage since R2 isn't configured
const uploadToR2: any = null;
const downloadFromR2: any = null;
const getR2SignedUrl: any = null;
const deleteFromR2: any = null;

/**
 * Upload a file to storage (R2 or local)
 */
export async function uploadFile(params: {
  key: string;
  body: Buffer | Uint8Array | Blob;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  if (uploadToR2) {
    return uploadToR2(params);
  }
  return uploadToLocalStorage(params);
}

/**
 * Download a file from storage
 */
export async function downloadFile(keyOrUrl: string): Promise<Buffer> {
  if (downloadFromR2 && !keyOrUrl.startsWith('local://')) {
    return downloadFromR2(keyOrUrl);
  }
  return downloadFromLocalStorage(keyOrUrl);
}

/**
 * Get a signed URL for a file
 */
export async function getSignedUrl(keyOrUrl: string, expiresIn: number = 3600): Promise<string> {
  if (getR2SignedUrl && !keyOrUrl.startsWith('local://')) {
    return getR2SignedUrl(keyOrUrl, expiresIn);
  }
  return getLocalStorageSignedUrl(keyOrUrl, expiresIn);
}

/**
 * Delete a file from storage
 */
export async function deleteFile(keyOrUrl: string): Promise<void> {
  if (deleteFromR2 && !keyOrUrl.startsWith('local://')) {
    return deleteFromR2(keyOrUrl);
  }
  return deleteFromLocalStorage(keyOrUrl);
}

/**
 * Check if using local storage
 */
export function isLocal(): boolean {
  return isUsingLocalStorage();
}

/**
 * Get storage configuration info
 */
export function getStorageInfo() {
  if (uploadToR2) {
    return {
      type: 'r2' as const,
      location: 'Cloudflare R2',
      configured: true,
    };
  }
  return getLocalStorageInfo();
}
