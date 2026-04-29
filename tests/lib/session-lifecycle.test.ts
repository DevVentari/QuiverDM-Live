import { describe, it, expect } from 'vitest';
import { deriveSessionPhase, type SessionForPhase } from '@/lib/session-lifecycle';

const base: SessionForPhase = {
  status: 'planning',
  aiSummaryStatus: 'none',
  aiSummary: null,
  recordingCount: 0,
  hasApprovedRecap: false,
};

describe('deriveSessionPhase', () => {
  it('returns prep when status is planning', () => {
    expect(deriveSessionPhase({ ...base, status: 'planning' })).toBe('prep');
  });

  it('returns ran when status is in_progress', () => {
    expect(deriveSessionPhase({ ...base, status: 'in_progress' })).toBe('ran');
  });

  it('returns ran when status is active', () => {
    expect(deriveSessionPhase({ ...base, status: 'active' })).toBe('ran');
  });

  it('returns processing when completed with no recordings', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 0 })).toBe('processing');
  });

  it('returns summary when completed with recording but no AI summary', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'pending' })).toBe('summary');
  });

  it('returns summary when aiSummaryStatus is processing', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'processing' })).toBe('summary');
  });

  it('returns recap when summary done but no approved recap', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'done', aiSummary: 'text', hasApprovedRecap: false })).toBe('recap');
  });

  it('returns complete when summary done and recap approved', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'done', aiSummary: 'text', hasApprovedRecap: true })).toBe('complete');
  });

  it('returns recap when aiSummaryStatus is error but has summary text', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'error', aiSummary: 'text', hasApprovedRecap: false })).toBe('recap');
  });
});
