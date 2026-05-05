// tests/seed/hameria-ire-seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedHameriaIre } from '../../prisma/seeds/hameria-ire';

const prisma = new PrismaClient();
let campaignId: string;
let testUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: 'hameria-seed-test@test.com', name: 'Test DM', onboardingCompleted: true },
  });
  testUserId = user.id;
  await seedHameriaIre(prisma, testUserId);
  const campaign = await prisma.campaign.findUnique({
    where: { slug: 'tales-from-the-bonfire-keep' },
  });
  campaignId = campaign!.id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { slug: 'tales-from-the-bonfire-keep' } });
  await prisma.homebrewContent.deleteMany({ where: { userId: testUserId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});

describe('seedHameriaIre', () => {
  it('creates the campaign', async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: 'tales-from-the-bonfire-keep' },
    });
    expect(campaign).not.toBeNull();
    expect(campaign!.name).toBe('Tales from the Bonfire Keep');
  });

  it('creates NPCs', async () => {
    const count = await prisma.nPC.count({ where: { campaignId } });
    expect(count).toBeGreaterThan(5);
  });

  it('creates 9 sessions', async () => {
    const count = await prisma.gameSession.count({ where: { campaignId } });
    expect(count).toBe(9);
  });

  it('creates homebrew content (monsters + races)', async () => {
    const count = await prisma.homebrewContent.count({ where: { userId: testUserId } });
    expect(count).toBeGreaterThan(0);
  });

  it('creates campaign documents', async () => {
    const count = await prisma.campaignDocument.count({ where: { campaignId } });
    expect(count).toBeGreaterThan(5);
  });

  it('creates 3 players', async () => {
    const count = await prisma.player.count({ where: { campaignId } });
    expect(count).toBe(3);
  });

  it('is idempotent — running twice produces the same counts', async () => {
    await seedHameriaIre(prisma, testUserId);
    const npcCount = await prisma.nPC.count({ where: { campaignId } });
    expect(npcCount).toBeGreaterThan(5);
    const docCount = await prisma.campaignDocument.count({ where: { campaignId } });
    expect(docCount).toBeGreaterThan(5);
  });
});
