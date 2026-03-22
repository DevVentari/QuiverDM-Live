import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';

const CODE_TTL_SECONDS = 600; // 10 minutes

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  const { searchParams } = req.nextUrl;
  const codeChallenge = searchParams.get('code_challenge');
  const method = searchParams.get('code_challenge_method');
  const redirectUri = searchParams.get('redirect_uri');

  if (!codeChallenge || method !== 'S256' || !redirectUri) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const isValidRedirect =
    redirectUri.startsWith('chrome-extension://') ||
    redirectUri.startsWith('moz-extension://') ||
    redirectUri.includes('.chromiumapp.org/') ||
    redirectUri.includes('.extensions.allizom.org/');
  if (!isValidRedirect) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const authCode = randomUUID();
  const key = `ext-auth-code:${authCode}`;

  await redis.set(
    key,
    JSON.stringify({
      userId: session.user.id,
      codeChallenge,
      method: 'S256',
    }),
    'EX',
    CODE_TTL_SECONDS
  );

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', authCode);
  return NextResponse.redirect(callbackUrl);
}
