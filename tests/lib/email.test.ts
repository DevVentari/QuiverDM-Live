import { describe, it, expect } from 'vitest';
import { emailService } from '@/lib/email';

describe('emailService', () => {
  it('returns not sent when not configured', async () => {
    const result = await emailService.sendWelcomeEmail({ to: 'test@example.com' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('not configured');
  });
});
