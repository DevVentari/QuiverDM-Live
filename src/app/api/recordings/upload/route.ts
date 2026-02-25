import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPresignedUploadUrl, generateFileKey } from '@/lib/storage/r2';
import { getStorageMode } from '@/lib/storage';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
  'audio/flac', 'audio/x-m4a', 'audio/aac',
];

/**
 * POST /api/recordings/upload
 *
 * In R2 mode (production): Returns a presigned upload URL.
 *   Body: { sessionId: string, filename: string, contentType: string, fileSize: number }
 *   Response: { uploadUrl: string, key: string }
 *   After upload: call trpc.sessionRecordings.create to register in DB.
 *
 * In local mode (development): Accepts file body and stores locally.
 *   Body: FormData { file, sessionId }
 *   Response: { url: string, key: string, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    if (getStorageMode() === 'r2') {
      // Presigned URL flow for production — browser uploads directly to R2
      const body = await request.json() as {
        sessionId: string;
        filename: string;
        contentType: string;
        fileSize: number;
      };

      const { sessionId, filename, contentType, fileSize } = body;

      if (!sessionId || !filename || !contentType) {
        return NextResponse.json(
          { error: 'sessionId, filename, and contentType are required' },
          { status: 400 }
        );
      }

      const isVideo = contentType.startsWith('video/');
      const isAudio = contentType.startsWith('audio/');
      if (!isVideo && !isAudio) {
        return NextResponse.json(
          { error: 'Only video and audio files are allowed' },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }

      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (fileSize > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 1GB' },
          { status: 400 }
        );
      }

      const key = generateFileKey(userId, sessionId, filename, 'session-recordings');
      // Presigned URL valid for 60 minutes (large files may take time to upload)
      const uploadUrl = await getPresignedUploadUrl(key, contentType, 3600);

      return NextResponse.json({ uploadUrl, key });
    } else {
      // Local development: accept file body via FormData
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const sessionId = formData.get('sessionId') as string | null;

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      if (!isVideo && !isAudio) {
        return NextResponse.json(
          { error: 'Only video and audio files are allowed' },
          { status: 400 }
        );
      }

      const maxSize = 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 1GB' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const key = generateLocalFileKey(userId, sessionId, file.name, 'session-recordings');
      const url = await uploadToLocal({ key, body: buffer, contentType: file.type });

      return NextResponse.json({
        success: true,
        url,
        key,
        filename: file.name,
        fileSize: file.size,
        type: isVideo ? 'video' : 'audio',
        contentType: file.type,
      });
    }
  } catch (error) {
    console.error('Error in recordings upload:', error);
    return NextResponse.json({ error: 'Failed to process upload request' }, { status: 500 });
  }
}
