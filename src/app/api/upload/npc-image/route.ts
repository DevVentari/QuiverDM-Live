import { NextRequest, NextResponse } from 'next/server';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';

// Check if R2 is configured
const isR2Configured =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const campaignId = formData.get('campaignId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!campaignId) {
      return NextResponse.json(
        { error: 'No campaign ID provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique key
    const fileKey = generateLocalFileKey(
      'temp-user', // TODO: Replace with actual user ID from auth
      campaignId,
      file.name,
      'npc-images'
    );

    // Upload to local storage (R2 can be added later)
    const url = await uploadToLocal({
      key: fileKey,
      body: buffer,
      contentType: file.type,
      metadata: {
        originalFilename: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      url,
      key: fileKey,
      storage: 'local', // Indicate storage type
    });
  } catch (error) {
    console.error('Error uploading NPC image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// Set max file size for the API route
export const config = {
  api: {
    bodyParser: false,
  },
};
