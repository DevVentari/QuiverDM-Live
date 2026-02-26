import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

  const jobs = await prisma.foundryImportJob.findMany({
    where: {
      campaignId: authResult.campaign.id,
      status: 'pending',
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 10,
  });

  return withFoundryCors(NextResponse.json({ jobs }));
}
