import { describe, it, expect, vi, beforeEach } from 'vitest';

const chat = vi.fn();
vi.mock('@main/lib/ai/chat', () => ({ chatWithAI: (...a: unknown[]) => chat(...a) }));

import { buildReviewedTranscript, buildMessages, generateSessionRecap } from '@main/lib/recapforge/generate-recap';

describe('buildReviewedTranscript', () => {
  it('drops struck lines and joins consecutive same-speaker lines', () => {
    const lines = [
      { index: 0, speaker: 'Kael', text: 'We ride at dawn.', start: 0 },
      { index: 1, speaker: 'Kael', text: 'Bring the torch.', start: 1 },
      { index: 2, speaker: 'DM', text: 'roll me a d20', start: 2 },
      { index: 3, speaker: 'Mara', text: 'The gate looms.', start: 3 },
    ];
    const oocMarks = [{ index: 2, verdict: 'strike' as const }];
    const out = buildReviewedTranscript(lines, oocMarks);
    expect(out).toContain('Kael: We ride at dawn. Bring the torch.');
    expect(out).not.toContain('roll me a d20');
    expect(out).toContain('Mara: The gate looms.');
  });
});

describe('buildMessages', () => {
  it('pins the schema and injects the party roster', () => {
    const m = buildMessages('Kael: hi', [{ characterName: 'Kael', characterClass: 'Fighter', name: 'Blake' }], { title: 'S1' });
    expect(m[0].role).toBe('system');
    expect(m[0].content).toMatch(/whereWeLeftOff/);
    expect(m[1].content).toContain('Kael');
    expect(m[1].content).toContain('Fighter');
  });
});

describe('generateSessionRecap', () => {
  beforeEach(() => {
    chat.mockReset();
  });

  function fakePrisma(overrides: Record<string, unknown> = {}) {
    const upsert = vi.fn().mockResolvedValue({});
    return {
      _upsert: upsert,
      campaignMember: { findFirst: vi.fn().mockResolvedValue({ id: 'm' }) },
      campaign: { findFirst: vi.fn().mockResolvedValue({ id: 'c1', theme: null }) },
      transcript: { findFirst: vi.fn().mockResolvedValue({
        id: 't1', timestamps: [{ start: 0, end: 1, text: 'We ride.', speaker: 'Kael' }], oocReviewItems: [],
      }) },
      player: { findMany: vi.fn().mockResolvedValue([{ characterName: 'Kael', characterClass: 'Fighter', name: 'Blake' }]) },
      gameSession: { findFirst: vi.fn().mockResolvedValue({ id: 's1', title: 'Session One', sessionNumber: 1 }) },
      forgeRecap: { upsert },
      ...overrides,
    } as unknown as import('@prisma/client').PrismaClient & { _upsert: typeof upsert };
  }
  const good = JSON.stringify({
    header: { eyebrow: 'Session One', title: 'Blood at the Gate' },
    statline: [], lede: 'They rode.',
    panels: { party: [{ name: 'Kael', status: 'alive' }], timeline: [], npcs: [], locations: [], adversaries: [], threads: [], whereWeLeftOff: 'The chant stopped.' },
  });

  it('writes status=ready with parsed content on a good model reply', async () => {
    chat.mockResolvedValueOnce(good);
    const prisma = fakePrisma();
    await generateSessionRecap(prisma, { campaignId: 'c1', sessionId: 's1' });
    const arg = (prisma as unknown as { _upsert: ReturnType<typeof vi.fn> })._upsert.mock.calls.at(-1)![0];
    expect(arg.update.status).toBe('ready');
    expect(arg.update.content.header.title).toBe('Blood at the Gate');
    expect(arg.update.themeSnapshot.palette.pelt).toMatch(/^#/);
    // Prisma upsert applies EITHER create OR update — never both. On a session's
    // first generation there is no pre-existing ForgeRecap row, so the CREATE
    // branch fires. The final fields must be present there too, or the recap
    // gets stuck at status='generating' forever on first run.
    expect(arg.create.status).toBe('ready');
    expect(arg.create.content.header.title).toBe('Blood at the Gate');
  });

  it('retries once then writes status=failed on unparseable replies', async () => {
    chat.mockResolvedValue('not json at all');
    const prisma = fakePrisma();
    await generateSessionRecap(prisma, { campaignId: 'c1', sessionId: 's1' });
    expect(chat).toHaveBeenCalledTimes(2);
    const arg = (prisma as unknown as { _upsert: ReturnType<typeof vi.fn> })._upsert.mock.calls.at(-1)![0];
    expect(arg.update.status).toBe('failed');
    // Same first-run guard as the success case: the CREATE branch fires when
    // no row pre-exists, so the failed status must land there too.
    expect(arg.create.status).toBe('failed');
  });
});
