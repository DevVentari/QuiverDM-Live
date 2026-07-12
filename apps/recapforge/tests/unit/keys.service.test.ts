import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getCobaltStatus, setCobalt, clearCobalt } from '@/server/services/keys.service';

const prisma = new PrismaClient();
const EMAIL = `keys-${Date.now()}@recapforge-test.local`;
let userId: string;

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email: EMAIL, name: 'Keys Test' } });
  userId = u.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('keys.service cobalt', () => {
  it('reports unset initially', async () => {
    expect(await getCobaltStatus(prisma, userId)).toEqual({ set: false, hint: null });
  });

  it('sets, masks, and round-trips through the shared encrypted column', async () => {
    await setCobalt(prisma, userId, 'cobalt-cookie-value-9x7q');
    const status = await getCobaltStatus(prisma, userId);
    expect(status.set).toBe(true);
    expect(status.hint).toBe('…9x7q');
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    expect(row?.dndBeyondCobaltCookie).not.toContain('cobalt-cookie-value'); // stored encrypted
  });

  it('clears', async () => {
    await clearCobalt(prisma, userId);
    expect((await getCobaltStatus(prisma, userId)).set).toBe(false);
  });
});
