import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';
import {
  authenticateFoundryRequest,
  foundryBridgeEnabled,
  optionsResponse,
  withFoundryCors,
} from '../_lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FoundryEventPayloadSchema = z.object({
  type: z.enum(['combat_round', 'hp_change', 'actor_death', 'combat_start', 'combat_end']),
  sessionId: z.string().cuid().optional(),
  payload: z.record(z.unknown()),
  foundryTimestamp: z.string().datetime().optional(),
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

  let parsedBody: z.infer<typeof FoundryEventPayloadSchema>;
  try {
    const body = await request.json();
    parsedBody = FoundryEventPayloadSchema.parse(body);
  } catch {
    return withFoundryCors(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }));
  }

  const payloadBytes = Buffer.byteLength(JSON.stringify(parsedBody.payload), 'utf8');
  if (payloadBytes > 4 * 1024) {
    return withFoundryCors(NextResponse.json({ error: 'Payload too large' }, { status: 413 }));
  }

  const windowStart = new Date(Date.now() - 60_000);
  const recentEventsCount = await prisma.foundryEvent.count({
    where: {
      campaignId: authResult.campaign.id,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  if (recentEventsCount >= 60) {
    return withFoundryCors(NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 }));
  }

  let sessionId = parsedBody.sessionId;

  if (!sessionId) {
    const activeSession = await prisma.gameSession.findFirst({
      where: {
        campaignId: authResult.campaign.id,
        status: 'in_progress',
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    sessionId = activeSession?.id;
  }

  if (!sessionId) {
    return withFoundryCors(NextResponse.json({ error: 'No active session found for campaign' }, { status: 409 }));
  }

  const ownsSession = await prisma.gameSession.findFirst({
    where: {
      id: sessionId,
      campaignId: authResult.campaign.id,
    },
    select: { id: true },
  });

  if (!ownsSession) {
    return withFoundryCors(NextResponse.json({ error: 'Session does not belong to campaign' }, { status: 400 }));
  }

  const event = await prisma.foundryEvent.create({
    data: {
      campaignId: authResult.campaign.id,
      sessionId,
      type: parsedBody.type,
      payload: parsedBody.payload as Prisma.InputJsonValue,
      foundryTimestamp: parsedBody.foundryTimestamp ? new Date(parsedBody.foundryTimestamp) : null,
    },
    select: {
      id: true,
    },
  });

  return withFoundryCors(NextResponse.json({ ok: true, eventId: event.id }));
}
