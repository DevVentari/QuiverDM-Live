import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import superjson from 'superjson';
import { z } from 'zod';
import { CampaignRole, PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';
import { prisma } from '@/lib/prisma';
import {
  verifyCampaignMembership,
  verifyCampaignRole,
  type CampaignMembershipResult,
} from './lib/ownership';
import { authz } from './services/authorization.service';
import { AppError } from './errors';
import { jwtVerify } from 'jose';
import type { ExtensionTokenPayload } from '@/lib/extension-types';

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

async function sessionFromBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as ExtensionTokenPayload;
    if (p.type !== 'extension-access' || !p.sub) return null;
    return { user: { id: p.sub } };
  } catch {
    return null;
  }
}

// Context with session
export async function createContext(opts?: { req?: Request }) {
  const session =
    (opts?.req ? await sessionFromBearerToken(opts.req) : null) ??
    (await auth());
  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Create tRPC instance with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.cause instanceof AppError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          code: error.cause.code,
          httpStatus: error.cause.statusCode,
        },
      };
    }
    return shape;
  },
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      // Ensure session.user is non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// =============================================================================
// PLATFORM ROLE PROCEDURES
// =============================================================================

export const wardenProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { platformRole: true },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires Warden or higher role' });
  }

  return next({
    ctx: {
      ...ctx,
      platformRole: user.platformRole,
    },
  });
});

export const mythkeeperProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { platformRole: true },
  });

  if (!user || user.platformRole !== PlatformRole.MYTHKEEPER) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires Mythkeeper role' });
  }

  return next({
    ctx: {
      ...ctx,
      platformRole: user.platformRole,
    },
  });
});

// =============================================================================
// CAMPAIGN MEMBERSHIP PROCEDURES (Multi-user support)
// =============================================================================

/**
 * Procedure that requires the user to be a member of the campaign.
 * Adds `membership` to context with role and permission info.
 *
 * Usage:
 * ```ts
 * campaignMemberProcedure
 *   .input(z.object({ campaignId: z.string(), ... }))
 *   .query(async ({ ctx, input }) => {
 *     // ctx.membership contains CampaignMembershipResult
 *     if (ctx.membership.isOwner) { ... }
 *   })
 * ```
 */
export const campaignMemberProcedure = protectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await verifyCampaignMembership(
      input.campaignId,
      ctx.session.user.id
    );

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });

/**
 * Procedure that requires the user to have DM-level access (OWNER or CO_DM).
 * Use for DM-only features like managing NPCs, viewing secrets, etc.
 */
export const campaignDMProcedure = protectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await verifyCampaignRole(
      input.campaignId,
      ctx.session.user.id,
      CampaignRole.CO_DM // CO_DM or higher (includes OWNER)
    );

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });

/**
 * Procedure that requires the user to be the campaign OWNER.
 * Use for destructive actions like deleting the campaign.
 */
export const campaignOwnerProcedure = protectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await verifyCampaignRole(
      input.campaignId,
      ctx.session.user.id,
      CampaignRole.OWNER
    );

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });

// Type helper for procedures with membership context
export type CampaignMemberContext = {
  session: NonNullable<Context['session']> & { user: NonNullable<Context['session']>['user'] };
  membership: CampaignMembershipResult;
};

// Export authorization service for use in procedures
export { authz };
