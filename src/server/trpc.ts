import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import superjson from 'superjson';

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
