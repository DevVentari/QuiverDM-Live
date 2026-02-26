import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  authenticateFoundryRequest,
  foundryBridgeEnabled,
  optionsResponse,
  withFoundryCors,
} from '../_lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ImportAckBodySchema = z.object({
  jobId: z.string(),
  status: z.enum(['delivered', 'error']),
  error: z.string().optional(),
});

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  if (!foundryBridgeEnabled()) {
    return withFoundryCors(NextResponse.json({ error: 'Foundry bridge disabled' }, { status: 404 }));
  }

  const authResult = await authenticateFoundryRequest(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  let parsedBody: z.infer<typeof ImportAckBodySchema>;
  try {
    parsedBody = ImportAckBodySchema.parse(await request.json());
  } catch {
    return withFoundryCors(NextResponse.json({ error: 'Invalid body' }, { status: 400 }));
  }

  const job = await prisma.foundryImportJob.findUnique({
    where: {
      id: parsedBody.jobId,
    },
    select: {
      id: true,
      campaignId: true,
    },
  });

  if (!job || job.campaignId !== authResult.campaign.id) {
    return withFoundryCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }

  await prisma.foundryImportJob.update({
    where: {
      id: parsedBody.jobId,
    },
    data: {
      status: parsedBody.status,
      error: parsedBody.error ?? null,
      deliveredAt: parsedBody.status === 'delivered' ? new Date() : null,
    },
  });

  return withFoundryCors(NextResponse.json({ ok: true }));
}
