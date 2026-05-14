import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'

export async function verifyFoundryRequest(
  req: Request,
  campaignId: string,
): Promise<boolean> {
  const key = req.headers.get('X-Quiver-Key')
  if (!key) return false
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { foundryApiKey: true },
  })
  if (!campaign?.foundryApiKey) return false
  return bcrypt.compare(key, campaign.foundryApiKey)
}
