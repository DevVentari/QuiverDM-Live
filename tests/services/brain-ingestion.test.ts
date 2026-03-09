import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chatWithAI: vi.fn(),
  brainRepository: {
    findEntities: vi.fn(),
    upsertEntity: vi.fn(),
    updateEntity: vi.fn(),
    recordAppearance: vi.fn(),
    logChange: vi.fn(),
    upsertRelationship: vi.fn(),
    appendRelationshipHistory: vi.fn(),
    getOrCreateState: vi.fn(),
    updateState: vi.fn(),
  },
  prisma: {
    $disconnect: vi.fn(),
  },
}));

vi.mock('@/lib/ai/chat', () => ({ chatWithAI: mocks.chatWithAI }));
vi.mock('@/server/repositories/brain.repository', () => ({ brainRepository: mocks.brainRepository }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/queue/queue', () => ({ getRedisConnection: vi.fn().mockReturnValue({}) }));
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

import { processBrainIngestionJob } from '@/lib/queue/brain-ingestion-worker';

const BASE_STATE = {
  id: 'state-1',
  campaignId: 'campaign-1',
  hooks: [],
  threats: [],
  pressurePolitical: 0.2,
  pressureSupernatural: 0.1,
  pressureEconomic: 0.0,
  pressureCosmic: 0.0,
  pressureSocial: 0.15,
  lastIngestedSessionId: null,
  prepSuggestions: [],
};

const JOB_DATA = {
  campaignId: 'campaign-1',
  sessionId: 'session-1',
  summary: 'The party met Korrath the Undying in the Ruins of Aelindra. He revealed a pact with the Obsidian Syndicate. A new threat looms.',
  highlights: [],
};

const AI_RESPONSE_JSON = JSON.stringify({
  newEntities: [
    {
      name: 'Korrath the Undying',
      type: 'NPC',
      description: 'A lich allied with the Obsidian Syndicate.',
      status: 'active',
    },
    {
      name: 'Obsidian Syndicate',
      type: 'FACTION',
      description: 'A shadowy criminal organization.',
      status: 'active',
    },
    {
      name: 'Ruins of Aelindra',
      type: 'LOCATION',
      description: 'Ancient ruins where Korrath resides.',
      status: 'active',
    },
  ],
  entityUpdates: [],
  relationships: [
    {
      fromEntityName: 'Korrath the Undying',
      toEntityName: 'Obsidian Syndicate',
      type: 'alliance',
      strength: 0.8,
      description: 'Korrath has a pact with the Syndicate.',
    },
  ],
  newHooks: [
    {
      text: 'Korrath\'s pact with the Obsidian Syndicate threatens the region.',
      urgency: 'high',
      linkedEntityNames: ['Korrath the Undying', 'Obsidian Syndicate'],
    },
  ],
  pressureShifts: { political: 0.05, supernatural: 0.1, economic: 0, cosmic: 0, social: 0 },
});

describe('processBrainIngestionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // First call: existing entities (empty). Second call: all entities after upsert (used for relationship lookup).
    mocks.brainRepository.findEntities
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { id: 'entity-korrath-the-undying', campaignId: 'campaign-1', name: 'Korrath the Undying', type: 'NPC', status: 'active', aliases: [], description: null, properties: {}, firstSeenSessionId: 'session-1', lastSeenSessionId: 'session-1', confidence: 0.8 },
        { id: 'entity-obsidian-syndicate', campaignId: 'campaign-1', name: 'Obsidian Syndicate', type: 'FACTION', status: 'active', aliases: [], description: null, properties: {}, firstSeenSessionId: 'session-1', lastSeenSessionId: 'session-1', confidence: 0.8 },
        { id: 'entity-ruins-of-aelindra', campaignId: 'campaign-1', name: 'Ruins of Aelindra', type: 'LOCATION', status: 'active', aliases: [], description: null, properties: {}, firstSeenSessionId: 'session-1', lastSeenSessionId: 'session-1', confidence: 0.8 },
      ]);
    mocks.brainRepository.upsertEntity.mockImplementation(async (_campaignId: string, data: any) => ({
      id: `entity-${data.name.replace(/\s+/g, '-').toLowerCase()}`,
      campaignId: _campaignId,
      name: data.name,
      type: data.type,
      status: data.status ?? 'active',
      aliases: [],
      description: data.description ?? null,
      properties: data.properties ?? {},
      firstSeenSessionId: data.firstSeenSessionId ?? null,
      lastSeenSessionId: data.lastSeenSessionId ?? null,
      confidence: data.confidence ?? null,
    }));
    mocks.brainRepository.updateEntity.mockResolvedValue({});
    mocks.brainRepository.recordAppearance.mockResolvedValue({});
    mocks.brainRepository.logChange.mockResolvedValue({});
    mocks.brainRepository.upsertRelationship.mockResolvedValue({ id: 'rel-1' });
    mocks.brainRepository.appendRelationshipHistory.mockResolvedValue({});
    mocks.brainRepository.getOrCreateState.mockResolvedValue({ ...BASE_STATE });
    mocks.brainRepository.updateState.mockResolvedValue({ ...BASE_STATE });

    mocks.chatWithAI.mockResolvedValue(AI_RESPONSE_JSON);
  });

  it('returns success: true and creates 3 entities from AI response', async () => {
    const result = await processBrainIngestionJob(JOB_DATA);

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(3);
    expect(result.entitiesUpdated).toBe(0);
  });

  it('calls upsertEntity once per new entity with correct type mapping', async () => {
    await processBrainIngestionJob(JOB_DATA);

    expect(mocks.brainRepository.upsertEntity).toHaveBeenCalledTimes(3);

    const calls = mocks.brainRepository.upsertEntity.mock.calls;
    const names = calls.map((c: any[]) => c[1].name);
    expect(names).toContain('Korrath the Undying');
    expect(names).toContain('Obsidian Syndicate');
    expect(names).toContain('Ruins of Aelindra');

    const npcCall = calls.find((c: any[]) => c[1].name === 'Korrath the Undying');
    expect(npcCall[1].type).toBe('NPC');
    expect(npcCall[1].lastSeenSessionId).toBe('session-1');
    expect(npcCall[1].firstSeenSessionId).toBe('session-1');
    expect(npcCall[1].confidence).toBe(0.8);
  });

  it('records appearance for each new entity', async () => {
    await processBrainIngestionJob(JOB_DATA);

    expect(mocks.brainRepository.recordAppearance).toHaveBeenCalledTimes(3);
    const calls = mocks.brainRepository.recordAppearance.mock.calls;
    calls.forEach((c: any[]) => {
      expect(c[0].sessionId).toBe('session-1');
      expect(c[0].campaignId).toBe('campaign-1');
    });
  });

  it('upserts the relationship extracted from AI response', async () => {
    await processBrainIngestionJob(JOB_DATA);

    expect(mocks.brainRepository.upsertRelationship).toHaveBeenCalledTimes(1);
    const relCall = mocks.brainRepository.upsertRelationship.mock.calls[0][0];
    expect(relCall.type).toBe('alliance');
    expect(relCall.strength).toBe(0.8);
    expect(relCall.campaignId).toBe('campaign-1');
  });

  it('adds hooks to world state', async () => {
    await processBrainIngestionJob(JOB_DATA);

    const updateCalls = mocks.brainRepository.updateState.mock.calls;
    const hookCall = updateCalls.find((c: any[]) => Array.isArray(c[1]?.hooks));
    expect(hookCall).toBeDefined();
    const newHooks = hookCall[1].hooks;
    expect(newHooks).toHaveLength(1);
    expect(newHooks[0].text).toContain('Korrath');
    expect(newHooks[0].urgency).toBe('high');
    expect(newHooks[0].status).toBe('open');
  });

  it('returns hooksAdded: 1', async () => {
    const result = await processBrainIngestionJob(JOB_DATA);
    expect(result.hooksAdded).toBe(1);
  });

  it('applies pressure shifts to current world state values', async () => {
    await processBrainIngestionJob(JOB_DATA);

    const updateCalls = mocks.brainRepository.updateState.mock.calls;
    const pressureCall = updateCalls.find((c: any[]) => 'pressurePolitical' in (c[1] ?? {}));
    expect(pressureCall).toBeDefined();
    expect(pressureCall[1].pressurePolitical).toBeCloseTo(0.25); // 0.2 + 0.05
    expect(pressureCall[1].pressureSupernatural).toBeCloseTo(0.2); // 0.1 + 0.1
  });

  it('does not create entities for unknown types', async () => {
    mocks.chatWithAI.mockResolvedValue(JSON.stringify({
      newEntities: [{ name: 'Unknown Thing', type: 'BOGUS_TYPE', status: 'active' }],
      entityUpdates: [],
      relationships: [],
      newHooks: [],
      pressureShifts: {},
    }));

    const result = await processBrainIngestionJob(JOB_DATA);

    expect(result.entitiesCreated).toBe(0);
    expect(mocks.brainRepository.upsertEntity).not.toHaveBeenCalled();
  });

  it('handles AI returning empty extraction gracefully', async () => {
    mocks.chatWithAI.mockResolvedValue(JSON.stringify({
      newEntities: [],
      entityUpdates: [],
      relationships: [],
      newHooks: [],
      pressureShifts: {},
    }));

    const result = await processBrainIngestionJob(JOB_DATA);

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(0);
    expect(result.hooksAdded).toBe(0);
    expect(mocks.brainRepository.upsertEntity).not.toHaveBeenCalled();
  });

  it('counts entity as updated (not created) when name:type key already exists in campaign', async () => {
    const existingKorrath = {
      id: 'entity-existing-1',
      name: 'Korrath the Undying',
      type: 'NPC',
      campaignId: 'campaign-1',
      status: 'active' as const,
      aliases: [],
      description: 'Old description',
      properties: {},
      firstSeenSessionId: 'session-0',
      lastSeenSessionId: 'session-0',
      confidence: 0.7,
    };

    // Reset queue from beforeEach and set both calls to return Korrath
    mocks.brainRepository.findEntities.mockReset();
    mocks.brainRepository.findEntities.mockResolvedValue([existingKorrath]);

    const result = await processBrainIngestionJob(JOB_DATA);

    // Korrath's key exists in existingEntityMap → worker increments entitiesUpdated, not entitiesCreated
    expect(result.entitiesUpdated).toBeGreaterThanOrEqual(1);
    // Other two new entities (Obsidian Syndicate, Ruins of Aelindra) are still created
    expect(result.entitiesCreated).toBe(2);
  });
});
