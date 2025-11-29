/**
 * Local File Serving API Route
 *
 * Serves files from the local uploads directory.
 * Only used when STORAGE_MODE=local.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './uploads';

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParts } = await params;

    if (!pathParts || pathParts.length === 0) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // Reconstruct the file path
    const filePath = pathParts.join('/');

    // Security: Prevent directory traversal
    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Build absolute path
    const absolutePath = path.resolve(LOCAL_STORAGE_PATH, filePath);
    const basePath = path.resolve(LOCAL_STORAGE_PATH);

    // Security: Ensure path is within uploads directory
    if (!absolutePath.startsWith(basePath)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await fs.readFile(absolutePath);
    const mimeType = getMimeType(filePath);

    // Get file stats for headers
    const stats = await fs.stat(absolutePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Last-Modified': stats.mtime.toUTCString(),
      },
    });
  } catch (error) {
    console.error('[API/files] Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
