import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { QDM_V3_COOKIE, shouldRewriteToV3 } from '@/lib/flags';

function isCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.startsWith('chrome-extension://') ||
    origin === 'https://quiverdm.com' ||
    origin === 'https://app.nerdt.au' ||
    origin === 'http://localhost:3847'
  );
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;
  const pathname = nextUrl.pathname;

  // CORS for tRPC — extension uses Bearer tokens, not cookies
  if (pathname.startsWith('/api/trpc')) {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: isCorsOrigin(origin) ? corsHeaders(origin!) : {},
      });
    }
    if (isCorsOrigin(origin)) {
      const res = NextResponse.next();
      Object.entries(corsHeaders(origin!)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    return NextResponse.next();
  }

  // Auth pages: redirect authenticated users to dashboard
  if (pathname.startsWith('/auth/')) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  // App routes: redirect unauthenticated users to signin
  // The (app) layout also checks this, but middleware is faster (edge-level)
  if (!isAuthenticated) {
    const signInUrl = new URL('/auth/signin', nextUrl);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // v3 opt-in: for migrated canonical paths, rewrite cookie-opted users into the
  // /v3 tree while keeping the canonical URL. Inert until MIGRATED_ROUTES is
  // populated (see src/lib/flags.ts), so today this never fires.
  const hasV3Cookie = req.cookies.get(QDM_V3_COOKIE)?.value === '1';
  if (shouldRewriteToV3(pathname, hasV3Cookie)) {
    return NextResponse.rewrite(new URL(`/v3${pathname}`, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // tRPC API (CORS for browser extension)
    '/api/trpc/:path*',
    // App routes that need auth
    '/dashboard/:path*',
    '/campaigns/:path*',
    '/characters/:path*',
    '/homebrew/:path*',
    '/settings/:path*',
    '/join/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    // v3 parallel tree (auth-guarded, opt-in)
    '/v3/:path*',
    // Auth routes (redirect if already logged in)
    '/auth/:path*',
  ],
};
