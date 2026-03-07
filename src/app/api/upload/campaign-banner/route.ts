import { NextRequest, NextResponse } from 'next/server';
import { storage, generateFileKey } from '@/lib/storage';
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
    const fileKey = generateFileKey(
      session.user.id,
      null,
      file.name,
      'campaign-banners'
    );

    const url = await storage.upload(fileKey, buffer, file.type);

    return NextResponse.json({ url, key: fileKey });
  } catch (error) {
    console.error('Error uploading campaign banner:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
