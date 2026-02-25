import { NextRequest, NextResponse } from 'next/server';
import { getFromLocal, existsInLocal } from '@/lib/storage/local-storage';
import { getPresignedDownloadUrl } from '@/lib/storage/r2';
import { getStorageMode } from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
  // Audio formats
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.webm': 'audio/webm',
  // Video formats
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
};

/**
 * Serve files from local storage
 * Supports HTTP Range requests for audio/video seeking
 * GET /api/storage/[...path]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');

    // Security check: prevent directory traversal
    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // In R2 mode: redirect to a presigned download URL
    if (getStorageMode() === 'r2') {
      const presignedUrl = await getPresignedDownloadUrl(filePath, 3600);
      return NextResponse.redirect(presignedUrl, { status: 302 });
    }

    // Local mode: serve from disk (development only)
    const exists = await existsInLocal(filePath);
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file
    const fileBuffer = await getFromLocal(filePath);
    const totalSize = fileBuffer.length;

    // Determine content type from extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
    const isMedia = contentType.startsWith('audio/') || contentType.startsWith('video/');

    // Handle Range requests for media files (enables seeking in audio/video players)
    const rangeHeader = request.headers.get('range');
    if (isMedia && rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        return new NextResponse(new Uint8Array(fileBuffer.subarray(start, end + 1)), {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      }
    }

    // Return full file
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(totalSize),
      'Cache-Control': 'public, max-age=31536000',
    };

    // Advertise range support for media files
    if (isMedia) {
      headers['Accept-Ranges'] = 'bytes';
    }

    return new NextResponse(new Uint8Array(fileBuffer), { headers });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
