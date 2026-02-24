import { usageService } from './usage.service';

/**
 * Check image generation limit for a user.
 * Delegates to usageService (UserUsage table, Option A caps).
 */
export async function checkImageGenerationLimit(userId: string) {
  const status = await usageService.getUsageStatus(userId);
  const { used, limit, remaining } = status.imageGenerations;
  return {
    allowed: limit === -1 || remaining > 0,
    remaining: limit === -1 ? Infinity : remaining,
    limit,
    used,
  };
}

export function estimateGenerationCost(provider: string): number {
  const costs: Record<string, number> = {
    comfyui: 0,
    replicate: 0.023,
    dalle: 0.04,
  };
  return costs[provider] ?? 0;
}
