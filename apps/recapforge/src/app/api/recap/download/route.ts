import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderDownload } from '@/server/services/recap.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaign') ?? '';
  const sessionId = req.nextUrl.searchParams.get('session') ?? '';
  if (!campaignId || !sessionId) return new NextResponse('Missing campaign/session', { status: 400 });

  try {
    const { filename, html } = await renderDownload(prisma, userId, { campaignId, sessionId });
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const code = (e as { code?: string }).code === 'FORBIDDEN' ? 403 : 400;
    return new NextResponse(e instanceof Error ? e.message : 'Failed', { status: code });
  }
}
