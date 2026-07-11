import type { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskKey } from '@quiverdm/shared';

export async function getCobaltStatus(prisma: PrismaClient, userId: string): Promise<{ set: boolean; hint: string | null }> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const cookie = settings?.dndBeyondCobaltCookie ? decrypt(settings.dndBeyondCobaltCookie) : '';
  return cookie ? { set: true, hint: maskKey(cookie) } : { set: false, hint: null };
}

export async function setCobalt(prisma: PrismaClient, userId: string, cookie: string): Promise<void> {
  const encrypted = encrypt(cookie.trim());
  await prisma.userSettings.upsert({
    where: { userId },
    update: { dndBeyondCobaltCookie: encrypted },
    create: { userId, dndBeyondCobaltCookie: encrypted },
  });
}

export async function clearCobalt(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.userSettings.updateMany({ where: { userId }, data: { dndBeyondCobaltCookie: null } });
}
