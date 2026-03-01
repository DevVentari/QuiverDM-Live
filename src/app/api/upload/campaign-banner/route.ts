import { NextRequest, NextResponse } from 'next/server';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = generateLocalFileKey(
      session.user.id,
      'global',
      file.name,
      'campaign-banners'
    );

    const url = await uploadToLocal({
      key: fileKey,
      body: buffer,
      contentType: file.type,
      metadata: { originalFilename: file.name, uploadedAt: new Date().toISOString() },
    });

    return NextResponse.json({ url, key: fileKey, storage: 'local' });
  } catch (error) {
    console.error('Error uploading campaign banner:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
