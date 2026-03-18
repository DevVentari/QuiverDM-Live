import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

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
    // Auth routes (redirect if already logged in)
    '/auth/:path*',
  ],
};
