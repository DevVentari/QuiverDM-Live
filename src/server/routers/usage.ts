/**
 * Usage Router
 * tRPC endpoints for tier-based usage limits
 */

import { router, protectedProcedure } from '../trpc';
import { usageService } from '../services/usage.service';

export const usageRouter = router({
  /**
   * Get current usage status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    return usageService.getUsageStatus(ctx.session.user.id);
  }),

  /**
   * Check if user can create a campaign
   */
  canCreateCampaign: protectedProcedure.query(async ({ ctx }) => {
    const canCreate = await usageService.canCreateCampaign(ctx.session.user.id);
    return { allowed: canCreate };
  }),

  /**
   * Check if user can upload a PDF
   */
  canUploadPdf: protectedProcedure.query(async ({ ctx }) => {
    const canUpload = await usageService.canUploadPdf(ctx.session.user.id);
    return { allowed: canUpload };
  }),

  /**
   * Manually check and reset usage period if needed
   */
  checkAndReset: protectedProcedure.mutation(async ({ ctx }) => {
    const wasReset = await usageService.checkAndResetIfNeeded(
      ctx.session.user.id
    );
    return { wasReset };
  }),
});
