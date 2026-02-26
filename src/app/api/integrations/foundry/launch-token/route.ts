import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import {
  authenticateFoundryRequest,
  foundryBridgeEnabled,
  getRequestOrigin,
  optionsResponse,
  withFoundryCors,
} from '../_lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  if (!foundryBridgeEnabled()) {
    return withFoundryCors(NextResponse.json({ error: 'Foundry bridge disabled' }, { status: 404 }));
  }

  const authResult = await authenticateFoundryRequest(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const activeSession = await prisma.gameSession.findFirst({
    where: {
      campaignId: authResult.campaign.id,
      status: 'in_progress',
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  const expiresIn = 300;
  const token = randomBytes(24).toString('base64url');
  const origin = getRequestOrigin(request);

  let launchUrl = `${origin}/campaigns/${authResult.campaign.slug}/sessions`;
  if (activeSession) {
    launchUrl = `${origin}/campaigns/${authResult.campaign.slug}/sessions/${activeSession.id}?token=${token}`;
  }

  return withFoundryCors(
    NextResponse.json({
      launchUrl,
      sessionId: activeSession?.id ?? null,
      expiresIn,
    })
  );
}
