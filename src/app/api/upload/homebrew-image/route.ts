import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateFileKey, storage } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get('file');
    const homebrewId = formData.get('homebrewId');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (typeof homebrewId !== 'string' || !homebrewId) {
      return NextResponse.json(
        { error: 'No homebrew ID provided' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const homebrew = await prisma.homebrewContent.findUnique({
      where: { id: homebrewId },
      select: { userId: true },
    });

    if (!homebrew || homebrew.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = generateFileKey(
      userId,
      null,
      file.name,
      `homebrew-images/uploaded/${homebrewId}`
    );
    const url = await storage.upload(fileKey, buffer, file.type);

    // Append URL to the homebrew content's images array
    await prisma.homebrewContent.update({
      where: { id: homebrewId },
      data: { images: { push: url } },
    });

    return NextResponse.json({
      url,
      key: fileKey,
    });
  } catch (error) {
    console.error('Error uploading homebrew image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
