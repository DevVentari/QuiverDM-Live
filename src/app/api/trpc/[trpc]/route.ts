import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get('origin') ?? '';
  const allowed =
    origin.startsWith('chrome-extension://') ||
    origin === 'https://quiverdm.com' ||
    origin === 'https://app.nerdt.au' ||
    origin === 'http://localhost:3847';

  if (!allowed) return res;

  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function OPTIONS(req: Request) {
  return withCors(req, new Response(null, { status: 204 }));
}

async function handler(req: Request) {
  const res = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });
  return withCors(req, res);
}

export { handler as GET, handler as POST };
