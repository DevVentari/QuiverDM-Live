import { prisma } from '@/lib/prisma';

const TIER_LIMITS: Record<string, { imagesPerMonth: number; isUnlimited: boolean }> = {
  free: { imagesPerMonth: 10, isUnlimited: false },
  pro: { imagesPerMonth: 100, isUnlimited: false },
  team: { imagesPerMonth: 1000, isUnlimited: true },
};

export async function checkImageGenerationLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
  const limits = TIER_LIMITS[user?.tier ?? 'free'] ?? TIER_LIMITS.free;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const used = await prisma.imageGenerationJob.count({
    where: {
      userId,
      status: { in: ['queued', 'processing', 'completed'] },
      createdAt: { gte: periodStart },
    },
  });

  const remaining = Math.max(0, limits.imagesPerMonth - used);
  return {
    allowed: limits.isUnlimited || remaining > 0,
    remaining,
    limit: limits.imagesPerMonth,
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
