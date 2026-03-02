import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

const { serverTrack } = await import('@/lib/analytics.server');

describe('serverTrack', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  it('calls posthog.capture with userId, event, and properties', async () => {
    await serverTrack('user-123', 'campaign_created', { campaign_id: 'abc' });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-123',
      event: 'campaign_created',
      properties: { campaign_id: 'abc' },
    });
    // shutdown must be called after capture
    expect(mockCapture.mock.invocationCallOrder[0])
      .toBeLessThan(mockShutdown.mock.invocationCallOrder[0]);
  });

  it('calls shutdown after capture', async () => {
    await serverTrack('user-123', 'campaign_created');
    expect(mockShutdown).toHaveBeenCalled();
  });

  it('works without properties', async () => {
    await serverTrack('user-456', 'onboarding_completed');
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-456',
      event: 'onboarding_completed',
      properties: undefined,
    });
  });
});
