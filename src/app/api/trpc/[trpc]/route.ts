import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';
import { NextRequest, NextResponse } from 'next/server';

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return null;
  const allowed =
    origin.startsWith('chrome-extension://') ||
    origin === 'https://quiverdm.com' ||
    origin === 'https://app.nerdt.au' ||
    origin === 'http://localhost:3847';
  if (!allowed) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get('origin'));
  if (!cors) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, { status: 204, headers: cors });
}

async function handler(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get('origin'));
  const res = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: (opts) => createContext(opts),
  });
  if (!cors) return res;
  const headers = new Headers(res.headers);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new NextResponse(res.body, { status: res.status, statusText: res.statusText, headers });
}

export { handler as GET, handler as POST };
