import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateFoundryRequest,
  foundryBridgeEnabled,
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

  return withFoundryCors(
    NextResponse.json({
      version: '2026-02-24-mvp',
      campaignId: authResult.campaign.id,
      tier: authResult.campaign.user.tier,
      features: {
        eventIngestion: true,
        sseStream: true,
        foundryBridge: foundryBridgeEnabled(),
      },
    })
  );
}
