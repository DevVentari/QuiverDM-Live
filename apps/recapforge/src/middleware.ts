import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/signup' ||
    pathname === '/api/health' ||
    pathname.startsWith('/w/');

  if (!req.auth && !isPublic) {
    const url = new URL('/auth/signin', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // api/uploads is excluded: middleware buffering caps request bodies at 10MB
  // (middlewareClientMaxBodySize), which truncated real multi-hundred-MB Craig
  // tracks. The upload route does its own auth() + campaign-owner check.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/uploads).*)'],
};
