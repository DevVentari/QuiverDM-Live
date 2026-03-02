import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapture = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    capture: mockCapture,
  },
}));

const { track, EVENTS } = await import('@/lib/analytics');

describe('analytics', () => {
  beforeEach(() => {
    mockCapture.mockClear();
  });

  it('track calls posthog.capture with event name and properties', () => {
    track(EVENTS.CAMPAIGN_CREATED, { campaign_id: 'abc' });
    expect(mockCapture).toHaveBeenCalledWith('campaign_created', { campaign_id: 'abc' });
  });

  it('track works without properties', () => {
    track(EVENTS.ONBOARDING_COMPLETED);
    expect(mockCapture).toHaveBeenCalledWith('onboarding_completed', undefined);
  });

  it('EVENTS contains all 6 tracked event names', () => {
    expect(EVENTS.CAMPAIGN_CREATED).toBe('campaign_created');
    expect(EVENTS.SESSION_STARTED).toBe('session_started');
    expect(EVENTS.PDF_UPLOADED).toBe('pdf_uploaded');
    expect(EVENTS.TRANSCRIPTION_STARTED).toBe('transcription_started');
    expect(EVENTS.HOMEBREW_CREATED).toBe('homebrew_created');
    expect(EVENTS.ONBOARDING_COMPLETED).toBe('onboarding_completed');
  });
});
