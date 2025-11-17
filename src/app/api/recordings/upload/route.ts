import { NextRequest, NextResponse } from 'next/server';
import {
  uploadToLocal,
  generateLocalFileKey,
  getLocalUrl,
} from '@/lib/local-storage';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for large video uploads

// Configure body size limit for this route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1gb',
    },
  },
};

/**
 * Upload video/audio file for session recording
 * (Use R2 in production by importing from @/lib/r2-storage instead)
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Validate file type (video or audio)
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (!isVideo && !isAudio) {
      return NextResponse.json(
        { error: 'Only video and audio files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 1GB)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 1GB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique key for local storage
    const key = generateLocalFileKey(
      userId,
      sessionId,
      file.name,
      'session-recordings'
    );

    // Upload to local storage
    const url = await uploadToLocal({
      key,
      body: buffer,
      contentType: file.type,
      metadata: {
        originalName: file.name,
        userId,
        sessionId,
        uploadedAt: new Date().toISOString(),
        type: isVideo ? 'video' : 'audio',
      },
    });

    return NextResponse.json({
      success: true,
      url,
      key,
      filename: file.name,
      fileSize: file.size,
      type: isVideo ? 'video' : 'audio',
      contentType: file.type,
    });
  } catch (error) {
    console.error('Error uploading recording:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
