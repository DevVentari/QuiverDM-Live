import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';

/** OWNER/CO_DM member or legacy campaign.userId owner — everyone else is refused. */
export async function assertCampaignOwner(prisma: PrismaClient, campaignId: string, userId: string): Promise<void> {
  const member = await prisma.campaignMember.findFirst({
    where: { campaignId, userId, role: { in: ['OWNER', 'CO_DM'] } },
    select: { id: true },
  });
  if (member) return;
  const legacyOwner = await prisma.campaign.findFirst({ where: { id: campaignId, userId }, select: { id: true } });
  if (legacyOwner) return;
  throw new TRPCError({ code: 'FORBIDDEN', message: 'This ledger belongs to another chronicler.' });
}
