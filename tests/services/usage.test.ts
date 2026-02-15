import { describe, it, expect } from 'vitest';
import { TIER_LIMITS } from '@/server/services/usage.service';

describe('TIER_LIMITS', () => {
  it('free tier has correct limits', () => {
    expect(TIER_LIMITS.free.campaigns).toBe(1);
    expect(TIER_LIMITS.free.transcriptionSeconds).toBe(1800);
    expect(TIER_LIMITS.free.pdfUploads).toBe(5);
  });

  it('pro tier has unlimited campaigns', () => {
    expect(TIER_LIMITS.pro.campaigns).toBe(-1);
  });

  it('team tier has highest limits', () => {
    expect(TIER_LIMITS.team.transcriptionSeconds).toBeGreaterThan(TIER_LIMITS.pro.transcriptionSeconds);
    expect(TIER_LIMITS.team.pdfUploads).toBeGreaterThan(TIER_LIMITS.pro.pdfUploads);
  });
});
