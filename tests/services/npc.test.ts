import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError, NotFoundError } from '@/server/errors';

const mocks = vi.hoisted(() => ({
  npcRepository: {
    findById: vi.fn(),
    findByCampaignId: vi.fn(),
    findByIds: vi.fn(),
    findFactions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  authz: {
    campaign: vi.fn(),
    npc: vi.fn(),
  },
  search: {
    indexNpc: vi.fn(),
    deleteNpc: vi.fn(),
    searchNpcs: vi.fn(),
  },
  queue: {
    addEmbeddingJob: vi.fn(),
  },
  embeddings: {
    deleteEntityEmbeddings: vi.fn(),
  },
}));

vi.mock('@/server/repositories/npc.repository', () => ({
  npcRepository: mocks.npcRepository,
}));

vi.mock('@/server/services/authorization.service', () => ({
  authz: mocks.authz,
}));

vi.mock('@/lib/search', () => ({
  indexNpc: mocks.search.indexNpc,
  deleteNpc: mocks.search.deleteNpc,
  searchNpcs: mocks.search.searchNpcs,
}));

vi.mock('@/lib/queue/embeddings-queue', () => ({
  addEmbeddingJob: mocks.queue.addEmbeddingJob,
}));

vi.mock('@/server/repositories/embedding.repository', () => ({
  deleteEntityEmbeddings: mocks.embeddings.deleteEntityEmbeddings,
}));

import { npcService } from '@/server/services/npc.service';

describe('npcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authz.campaign.mockReturnValue({
      verify: vi.fn().mockResolvedValue({ isDM: true, member: null }),
      requirePermission: vi.fn().mockResolvedValue({ isDM: true, member: null }),
    });

    mocks.authz.npc.mockReturnValue({
      verify: vi.fn().mockResolvedValue({ isDM: true, member: null }),
      requireEdit: vi.fn().mockResolvedValue({ isDM: true, member: null }),
    });

    mocks.search.indexNpc.mockResolvedValue(undefined);
    mocks.search.deleteNpc.mockResolvedValue(undefined);
    mocks.search.searchNpcs.mockResolvedValue([]);
    mocks.queue.addEmbeddingJob.mockResolvedValue(undefined);
    mocks.embeddings.deleteEntityEmbeddings.mockResolvedValue(undefined);
  });

  it('throws ValidationError when creating NPC without a name', async () => {
    await expect(
      npcService.create('campaign-1', 'user-1', { name: '' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when name exceeds 255 chars', async () => {
    await expect(
      npcService.create('campaign-1', 'user-1', { name: 'a'.repeat(256) })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('stores XSS-like description as-is without crashing', async () => {
    mocks.npcRepository.create.mockImplementation(async (data: any) => ({
      id: 'npc-1',
      campaignId: data.campaignId,
      name: data.name,
      description: data.description,
      faction: null,
      role: null,
      tags: [],
      secrets: null,
    }));

    const result = await npcService.create('campaign-1', 'user-1', {
      name: 'Suspicious NPC',
      description: '<script>alert(1)</script>',
    });

    expect(result.description).toBe('<script>alert(1)</script>');
  });

  it('throws NotFoundError when NPC does not exist', async () => {
    mocks.npcRepository.findById.mockResolvedValue(null);

    await expect(npcService.getById('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does partial update without wiping unspecified fields', async () => {
    mocks.npcRepository.update.mockImplementation(async (_id: string, data: any) => ({
      id: 'npc-1',
      campaignId: 'campaign-1',
      name: data.name ?? 'Old Name',
      description: 'Keeps description',
      faction: 'Guild',
      role: 'Scout',
      tags: ['tag1'],
      secrets: 'secret',
    }));

    const result = await npcService.update('npc-1', 'user-1', { name: 'New Name' });

    expect(mocks.npcRepository.update).toHaveBeenCalledWith('npc-1', { name: 'New Name' });
    expect(result.description).toBe('Keeps description');
  });

  it('deleted NPC is not returned by campaign list query', async () => {
    let items = [
      { id: 'npc-1', campaignId: 'campaign-a', name: 'Alpha' },
      { id: 'npc-2', campaignId: 'campaign-a', name: 'Beta' },
    ];

    mocks.npcRepository.remove.mockImplementation(async (id: string) => {
      items = items.filter((npc) => npc.id !== id);
    });
    mocks.npcRepository.findByCampaignId.mockImplementation(async (campaignId: string) =>
      items.filter((npc) => npc.campaignId === campaignId)
    );

    await npcService.delete('npc-1', 'user-1');
    const result = await npcService.getByCampaignId('campaign-a', 'user-1');

    expect(result.map((npc: any) => npc.id)).toEqual(['npc-2']);
  });

  it('scopes list queries to the requested campaign', async () => {
    mocks.npcRepository.findByCampaignId.mockImplementation(async (campaignId: string) =>
      [{ id: 'npc-b', campaignId, name: 'B NPC' }]
    );

    const result = await npcService.getByCampaignId('campaign-b', 'user-1');

    expect(result).toEqual([{ id: 'npc-b', campaignId: 'campaign-b', name: 'B NPC' }]);
  });

  it('still creates NPC when search indexing fails', async () => {
    mocks.npcRepository.create.mockResolvedValue({
      id: 'npc-1',
      campaignId: 'campaign-1',
      name: 'Resilient NPC',
      description: null,
      faction: null,
      role: null,
      tags: [],
      secrets: null,
    });
    mocks.search.indexNpc.mockRejectedValue(new Error('Meili down'));

    const result = await npcService.create('campaign-1', 'user-1', {
      name: 'Resilient NPC',
    });

    expect(result.id).toBe('npc-1');
    expect(mocks.npcRepository.create).toHaveBeenCalled();
  });
});
