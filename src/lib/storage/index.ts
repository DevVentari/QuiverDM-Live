/**
 * Storage Abstraction Layer
 *
 * Provides a unified interface for file storage that can switch between
 * local filesystem (for development) and Cloudflare R2 (for production).
 *
 * Set STORAGE_MODE=local in .env.local for local development.
 * Set STORAGE_MODE=r2 for production with Cloudflare R2.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Storage mode from environment
const STORAGE_MODE = process.env.STORAGE_MODE || 'local';
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './uploads';

/**
 * Storage provider interface
 */
export interface StorageProvider {
  upload(key: string, data: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  exists(key: string): Promise<boolean>;
}

/**
 * Local filesystem storage provider
 */
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string = LOCAL_STORAGE_PATH) {
    this.basePath = path.resolve(basePath);
  }

  private getFilePath(key: string): string {
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Invalid file path');
    }
    return resolved;
  }

  async upload(key: string, data: Buffer, _contentType?: string): Promise<string> {
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, data);

    // Return URL for accessing the file
    return `/api/files/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getUrl(key: string): string {
    return `/api/files/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the absolute file path for a key (for direct file access)
   */
  getAbsolutePath(key: string): string {
    return this.getFilePath(key);
  }
}

/**
 * Cloudflare R2 storage provider
 * Wraps existing r2-storage.ts functions
 */
class R2StorageProvider implements StorageProvider {
  private r2Module: typeof import('./r2') | null = null;

  private async getR2Module() {
    if (!this.r2Module) {
      this.r2Module = await import('./r2');
    }
    return this.r2Module;
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    const r2 = await this.getR2Module();
    await r2.uploadToR2({
      key,
      body: data,
      contentType,
    });
    // Return a path that our /api/storage route can serve via presigned URL
    return `/api/storage/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const r2 = await this.getR2Module();
    return r2.downloadFromR2(key);
  }

  async delete(key: string): Promise<void> {
    const r2 = await this.getR2Module();
    return r2.deleteFromR2(key);
  }

  getUrl(key: string): string {
    // For R2, we return a path that will trigger presigned URL generation
    return `/api/storage/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const r2 = await this.getR2Module();
    return r2.existsInR2(key);
  }
}

// Create storage instance based on mode
let storageInstance: StorageProvider | null = null;

/**
 * Get the configured storage provider
 */
export function getStorage(): StorageProvider {
  if (!storageInstance) {
    if (STORAGE_MODE === 'r2') {
      storageInstance = new R2StorageProvider();
    } else {
      storageInstance = new LocalStorageProvider();
    }
  }
  return storageInstance;
}

/**
 * Default storage export for convenience
 */
export const storage = {
  get provider(): StorageProvider {
    return getStorage();
  },

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    return getStorage().upload(key, data, contentType);
  },

  async download(key: string): Promise<Buffer> {
    return getStorage().download(key);
  },

  async delete(key: string): Promise<void> {
    return getStorage().delete(key);
  },

  getUrl(key: string): string {
    return getStorage().getUrl(key);
  },

  async exists(key: string): Promise<boolean> {
    return getStorage().exists(key);
  },
};

/**
 * Generate a unique file key
 */
export function generateFileKey(
  userId: string,
  campaignId: string | null,
  filename: string,
  prefix: string = 'files'
): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const campaignPart = campaignId || 'general';

  return `${prefix}/${userId}/${campaignPart}/${timestamp}-${randomString}-${sanitizedFilename}`;
}

/**
 * Get storage mode
 */
export function getStorageMode(): 'local' | 'r2' {
  return STORAGE_MODE as 'local' | 'r2';
}

/**
 * Check if using local storage
 */
export function isLocalStorage(): boolean {
  return STORAGE_MODE === 'local';
}

/**
 * Get local storage path (for direct file access in local mode)
 */
export function getLocalStoragePath(): string {
  return path.resolve(LOCAL_STORAGE_PATH);
}

// Export the local storage class for direct access when needed
export { LocalStorageProvider };

/**
 * Get a signed URL for file access
 * For local storage, returns a direct path
 * For R2, returns a presigned URL
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (STORAGE_MODE === 'r2') {
    const r2 = await import('./r2');
    return r2.getPresignedDownloadUrl(key, expiresIn);
  }
  // For local storage, just return the local URL path
  return `/api/files/${key}`;
}
