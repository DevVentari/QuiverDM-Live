import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
vi.stubGlobal('fetch', mockFetch);

import { postSummaryToDiscord } from '../post-summary';

describe('postSummaryToDiscord', () => {
  beforeEach(() => mockFetch.mockClear());

  it('sends single message for free users', async () => {
    await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'Session 7', 'Short summary', false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toContain('**Session 7**');
    expect(body.content).toContain('Short summary');
  });

  it('truncates to 2000 chars for free users', async () => {
    const longSummary = 'a'.repeat(3000);
    await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', longSummary, false);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content.length).toBeLessThanOrEqual(2000);
  });

  it('sends 2 messages for subscribers with long summary', async () => {
    const longSummary = 'b'.repeat(3000);
    await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', longSummary, true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on webhook error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' });
    await expect(
      postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', 'summary', false)
    ).rejects.toThrow('Discord webhook failed');
  });
});
