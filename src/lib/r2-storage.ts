import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

if (!process.env.R2_ACCOUNT_ID) {
  throw new Error('R2_ACCOUNT_ID environment variable is required');
}

if (!process.env.R2_ACCESS_KEY_ID) {
  throw new Error('R2_ACCESS_KEY_ID environment variable is required');
}

if (!process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
}

if (!process.env.R2_BUCKET_NAME) {
  throw new Error('R2_BUCKET_NAME environment variable is required');
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

/**
 * Create R2 S3-compatible client
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to R2
 */
export async function uploadToR2(params: {
  key: string;
  body: Buffer | Uint8Array | Blob;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
  });

  await r2Client.send(command);

  // Return the R2 URL
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${params.key}`;
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Download a file from R2 and return as Buffer
 * @param urlOrKey - Either a full R2 URL or just the file key
 * @returns Promise resolving to file buffer
 */
export async function downloadFromR2(urlOrKey: string): Promise<Buffer> {
  // Extract key if a full URL was provided
  const key = urlOrKey.startsWith('http') ? extractKeyFromUrl(urlOrKey) : urlOrKey;

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);

  if (!response.Body) {
    throw new Error(`No data returned from R2 for key: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Generate a presigned URL for downloading a file from R2
 * @param key - The file key in R2
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn });
  return url;
}

/**
 * Generate a presigned URL for uploading a file to R2
 * @param key - The file key in R2
 * @param contentType - The file content type
 * @param expiresIn - URL expiration time in seconds (default: 10 minutes)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn });
  return url;
}

/**
 * Generate a unique file key for R2 storage
 * @param userId - User ID
 * @param campaignId - Campaign ID
 * @param filename - Original filename
 * @param prefix - Optional prefix (e.g., 'homebrew', 'recordings')
 */
export function generateFileKey(
  userId: string,
  campaignId: string,
  filename: string,
  prefix: string = 'files'
): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  return `${prefix}/${userId}/${campaignId}/${timestamp}-${randomString}-${sanitizedFilename}`;
}

/**
 * Extract file key from R2 URL
 */
export function extractKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  return urlObj.pathname.substring(1); // Remove leading slash
}
