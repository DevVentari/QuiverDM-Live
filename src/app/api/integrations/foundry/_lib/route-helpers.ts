import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db';
import { parseCampaignIdFromFoundryApiKey } from '@/server/foundry-api-key';

export const FOUNDRY_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function foundryBridgeEnabled(): boolean {
  return process.env.FOUNDRY_BRIDGE_ENABLED === 'true';
}

export function optionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: FOUNDRY_CORS_HEADERS,
  });
}

export function withFoundryCors(response: NextResponse): NextResponse {
  Object.entries(FOUNDRY_CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function parseBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

export async function authenticateFoundryRequest(request: NextRequest) {
  const rawKey = parseBearerToken(request);
  if (!rawKey) {
    return { error: withFoundryCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })) };
  }

  const campaignId = parseCampaignIdFromFoundryApiKey(rawKey);
  if (!campaignId) {
    return { error: withFoundryCors(NextResponse.json({ error: 'Invalid API key format' }, { status: 401 })) };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      slug: true,
      userId: true,
      foundryApiKey: true,
      foundryModuleVersion: true,
      user: {
        select: {
          tier: true,
        },
      },
    },
  });

  if (!campaign?.foundryApiKey) {
    return { error: withFoundryCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })) };
  }

  const validKey = await bcrypt.compare(rawKey, campaign.foundryApiKey);
  if (!validKey) {
    return { error: withFoundryCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 })) };
  }

  return {
    campaign,
  };
}

export function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host) {
    return `https://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3847';
}
