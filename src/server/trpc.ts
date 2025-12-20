import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import superjson from 'superjson';
import { z } from 'zod';
import { CampaignRole } from '@prisma/client';
import {
  verifyCampaignMembership,
  verifyCampaignRole,
  type CampaignMembershipResult,
} from './lib/ownership';

// Context with session
export async function createContext() {
  const session = await auth();
  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Create tRPC instance with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,
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
