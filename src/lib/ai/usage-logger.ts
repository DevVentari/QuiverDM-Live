import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { estimateCost } from './pricing';

export interface ApiUsageEntry {
  userId: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  metadata?: Record<string, unknown>;
}

export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const cost = estimateCost(entry.model, entry.tokensIn, entry.tokensOut);
    await prisma.apiUsageLog.create({
      data: {
        userId: entry.userId,
        provider: entry.provider,
        model: entry.model,
        feature: entry.feature,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        estimatedCost: cost,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error('[ApiUsageLogger] Failed to log usage:', err);
  }
}
