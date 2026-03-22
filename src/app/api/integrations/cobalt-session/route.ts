import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = await redis.get(`ext-token:${token}`);
  return userId ? String(userId) : null;
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { cobaltSession?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { cobaltSession } = body;
  if (!cobaltSession || typeof cobaltSession !== 'string') {
    return NextResponse.json({ error: 'cobaltSession is required' }, { status: 400 });
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { dndBeyondCobaltCookie: encrypt(cobaltSession) },
    create: { userId, dndBeyondCobaltCookie: encrypt(cobaltSession) },
  });

  return NextResponse.json({ ok: true });
}
