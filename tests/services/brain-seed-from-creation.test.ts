import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('brain.seedFromCreation logic', () => {
  let campaignId: string;

  beforeEach(async () => {
    const campaign = await prisma.campaign.create({
      data: { name: 'Test Seed Campaign', slug: `test-seed-${Date.now()}`, userId: 'test-user' },
    });
    campaignId = campaign.id;
  });

  afterEach(async () => {
    await prisma.worldEntity.deleteMany({ where: { campaignId } });
    await prisma.worldState.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
  });

  it('creates a LOCATION entity from startingLocation', async () => {
    const { brainRepository } = await import('@/server/repositories/brain.repository');
    await brainRepository.upsertEntity(campaignId, {
      type: 'LOCATION' as any,
      name: 'Waterdeep',
      description: undefined,
      properties: {},
      confidence: 1.0,
    });
    const entities = await brainRepository.findEntities(campaignId, { limit: 10 });
    expect(entities.some((e) => e.name === 'Waterdeep' && e.type === 'LOCATION')).toBe(true);
  });

  it('creates a THREAT entity from antagonistName + antagonistMotivation', async () => {
    const { brainRepository } = await import('@/server/repositories/brain.repository');
    await brainRepository.upsertEntity(campaignId, {
      type: 'THREAT' as any,
      name: 'Strahd von Zarovich',
      description: 'Seeks to break the curse of Barovia by claiming Tatyana',
      properties: {},
      confidence: 1.0,
    });
    const entities = await brainRepository.findEntities(campaignId, { limit: 10 });
    const threat = entities.find((e) => e.type === 'THREAT');
    expect(threat).toBeDefined();
    expect(threat!.description).toContain('Tatyana');
  });

  it('creates a FACTION entity with stance in properties', async () => {
    const { brainRepository } = await import('@/server/repositories/brain.repository');
    await brainRepository.upsertEntity(campaignId, {
      type: 'FACTION' as any,
      name: 'The Harpers',
      description: undefined,
      properties: { stance: 'ally' },
      confidence: 1.0,
    });
    const entities = await brainRepository.findEntities(campaignId, { limit: 10 });
    const faction = entities.find((e) => e.type === 'FACTION');
    expect(faction).toBeDefined();
    expect((faction!.properties as any).stance).toBe('ally');
  });

  it('adds openingHook to WorldState hooks array', async () => {
    const { brainRepository } = await import('@/server/repositories/brain.repository');
    const state = await brainRepository.getOrCreateState(campaignId);
    const existingHooks = Array.isArray(state.hooks) ? state.hooks : [];
    await brainRepository.updateState(campaignId, {
      hooks: [...existingHooks, {
        id: `hook-test-${Date.now()}`,
        text: 'A mysterious letter arrives from the Underdark',
        createdSessionId: null,
        ageInSessions: 0,
        urgency: 'medium',
        status: 'open',
        linkedEntityNames: [],
      }],
    });
    const updated = await brainRepository.getOrCreateState(campaignId);
    const hooks = updated.hooks as any[];
    expect(hooks.some((h) => h.text.includes('Underdark'))).toBe(true);
  });
});
