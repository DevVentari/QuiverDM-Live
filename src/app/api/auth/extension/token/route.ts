import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { randomBytes, createHash } from 'crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface StoredAuthCode {
  userId: string;
  codeChallenge: string;
  method: string;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { code, code_verifier } = body;
  if (!code || !code_verifier) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const key = `ext-auth-code:${code}`;
  const raw = await redis.get(key);
  if (!raw) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  const stored: StoredAuthCode = JSON.parse(raw as string);

  // Verify PKCE
  const digest = createHash('sha256').update(code_verifier).digest('base64url');
  if (digest !== stored.codeChallenge) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // Consume code (one-time use)
  await redis.del(key);

  // Issue access token
  const accessToken = randomBytes(32).toString('hex');
  await redis.set(`ext-token:${accessToken}`, stored.userId, 'EX', TOKEN_TTL_SECONDS);

  return NextResponse.json({ access_token: accessToken, token_type: 'Bearer' });
}
