import { describe, it, expect, vi } from 'vitest';

const add = vi.fn().mockResolvedValue({ id: 'job1' });
vi.mock('bullmq', () => ({ Queue: vi.fn().mockImplementation(() => ({ add })) }));
vi.mock('ioredis', () => ({ default: vi.fn() }));

import { addForgeRecapJob } from '@/lib/queue';

describe('addForgeRecapJob', () => {
  it('enqueues with a stable per-session jobId', async () => {
    await addForgeRecapJob({ campaignId: 'c1', sessionId: 's1', userId: 'u1' });
    expect(add).toHaveBeenCalledWith(
      'forge-recap-s1',
      { campaignId: 'c1', sessionId: 's1', userId: 'u1' },
      { jobId: 'forge-recap-s1' },
    );
  });
});
