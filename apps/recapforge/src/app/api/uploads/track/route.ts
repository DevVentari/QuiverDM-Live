import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCampaignOwner } from '@/server/guards';
import { getStorage } from '@main/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = req.nextUrl.searchParams.get('key');
  if (!key || !key.startsWith('session-recordings/')) {
    return NextResponse.json({ error: 'Invalid upload key' }, { status: 400 });
  }

  const recording = await prisma.sessionRecording.findFirst({
    where: { originalUrl: key },
    select: { id: true, session: { select: { campaignId: true } } },
  });
  if (!recording) return NextResponse.json({ error: 'Unknown upload key' }, { status: 404 });
  try {
    await assertCampaignOwner(prisma, recording.session.campaignId, session.user.id);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  // Shared, mode-aware: R2 in prod (what the worker reads), local disk in dev.
  await getStorage().upload(key, buf, file.type || 'audio/flac');
  return NextResponse.json({ success: true, key, fileSize: buf.length });
}
