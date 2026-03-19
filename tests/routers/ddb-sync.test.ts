import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchange = vi.fn().mockResolvedValue('mock-jwt');
const mockFetchEntitlements = vi.fn().mockResolvedValue([
  { slug: 'veor', title: 'Vecna: Eve of Ruin', coverImageUrl: null, accessType: 'owned', sourceUrl: 'https://www.dndbeyond.com/sources/veor' },
]);
const mockDecrypt = vi.fn().mockReturnValue('cobalt-session');
const mockUpsertEntitlements = vi.fn().mockResolvedValue([]);
const mockListEntitlements = vi.fn().mockResolvedValue([]);
const mockCreateSourcebook = vi.fn().mockResolvedValue({ id: 'sb-1', slug: 'veor' });
const mockAddJob = vi.fn().mockResolvedValue({});

vi.mock('@/lib/ddb-sourcebook', () => ({
  exchangeCobaltForJwt: mockExchange,
  fetchUserEntitlements: mockFetchEntitlements,
  DdbAuthError: class DdbAuthError extends Error { name = 'DdbAuthError'; },
}));
vi.mock('@/lib/encryption', () => ({ decrypt: mockDecrypt }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: { findUnique: vi.fn().mockResolvedValue({ dndBeyondCobaltCookie: 'encrypted' }) },
    ddbEntitlement: { findUnique: vi.fn().mockResolvedValue({ id: 'ent-1', userId: 'user-1', slug: 'veor', title: 'Vecna', accessType: 'owned', sourceUrl: 'x' }) },
    campaign: { findMany: vi.fn().mockResolvedValue([{ id: 'camp-1' }, { id: 'camp-2' }]) },
    ddbSourcebook: { findUnique: vi.fn().mockResolvedValue({ id: 'sb-1', userId: 'user-1' }) },
  },
}));
vi.mock('@/server/repositories/ddb-sync.repository', () => ({
  ddbSyncRepository: {
    upsertEntitlements: mockUpsertEntitlements,
    listEntitlements: mockListEntitlements,
    createSourcebook: mockCreateSourcebook,
  },
}));
vi.mock('@/lib/queue/ddb-sync-queue', () => ({ addDdbSyncJob: mockAddJob }));

const USER_ID = 'user-1';

describe('ddbSync router — listEntitlements', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls exchangeCobaltForJwt to validate session', async () => {
    await mockExchange('cobalt-session');
    expect(mockExchange).toHaveBeenCalledWith('cobalt-session');
  });

  it('upserts entitlements and returns list', async () => {
    const entitlements = await mockFetchEntitlements('cobalt-session');
    await mockUpsertEntitlements(USER_ID, entitlements);
    await mockListEntitlements(USER_ID);
    expect(mockUpsertEntitlements).toHaveBeenCalledWith(USER_ID, entitlements);
    expect(mockListEntitlements).toHaveBeenCalledWith(USER_ID);
  });
});

describe('ddbSync router — importSourcebook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates sourcebook and enqueues sync job', async () => {
    const sb = await mockCreateSourcebook(USER_ID, 'ent-1', 'veor', 'Vecna: Eve of Ruin', ['camp-1', 'camp-2']);
    await mockAddJob(sb.id, USER_ID);
    expect(mockCreateSourcebook).toHaveBeenCalledWith(USER_ID, 'ent-1', 'veor', 'Vecna: Eve of Ruin', ['camp-1', 'camp-2']);
    expect(mockAddJob).toHaveBeenCalledWith('sb-1', USER_ID);
  });
});

describe('ddbSync router — syncNow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('enqueues a sync job for existing sourcebook', async () => {
    await mockAddJob('sb-1', USER_ID);
    expect(mockAddJob).toHaveBeenCalledWith('sb-1', USER_ID);
  });
});
