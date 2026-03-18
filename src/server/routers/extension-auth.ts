import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { TRPCError } from '@trpc/server';
import type { ExtensionTokenPayload } from '@/lib/extension-types';

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
const ACCESS_TTL_SECONDS = 3600;      // 1 hour
const REFRESH_TTL_SECONDS = 2592000;  // 30 days

async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'extension-access' } satisfies Partial<ExtensionTokenPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(SECRET);
}

async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'extension-refresh' } satisfies Partial<ExtensionTokenPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(SECRET);
}

export const extensionAuthRouter = router({
  exchangeExtensionCode: publicProcedure
    .input(
      z.object({
        code: z.string().uuid(),
        codeVerifier: z.string().min(43).max(128),
      })
    )
    .mutation(async ({ input }) => {
      const key = `ext-auth-code:${input.code}`;
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired auth code' });
      }

      // Single-use: delete before processing to prevent replay
      await redis.del(key);

      const stored = JSON.parse(raw) as {
        userId: string;
        codeChallenge: string;
        method: string;
      };

      // Verify PKCE: SHA-256(codeVerifier) base64url === storedCodeChallenge
      const digest = createHash('sha256').update(input.codeVerifier).digest('base64url');
      if (digest !== stored.codeChallenge) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'PKCE verification failed' });
      }

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(stored.userId),
        signRefreshToken(stored.userId),
      ]);

      return { accessToken, refreshToken };
    }),

  refreshExtensionToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      let payload: ExtensionTokenPayload;
      try {
        const { payload: p } = await jwtVerify(input.refreshToken, SECRET);
        payload = p as unknown as ExtensionTokenPayload;
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
      }

      if (payload.type !== 'extension-refresh') {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Wrong token type' });
      }

      const accessToken = await signAccessToken(payload.sub);
      return { accessToken };
    }),
});

export type ExtensionAuthRouter = typeof extensionAuthRouter;
