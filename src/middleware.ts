import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;
  const pathname = nextUrl.pathname;

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
