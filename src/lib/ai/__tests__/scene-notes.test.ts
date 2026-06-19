import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedSceneNotes, draftNote, suggestNotes, refineNote, type NoteContext } from '../scene-notes';
import * as chat from '../chat';

const CTX: NoteContext = {
  intent: "Party reaches Glasstaff's lair.",
  tagged: [{ id: 'e1', name: 'Glasstaff', type: 'NPC', history: ['Fled the cellar last session'] }],
  party: [{ name: 'Tharivol', summary: 'Elf wizard', hook: "Hunts the Redbrands who killed his sister" }],
};

beforeEach(() => vi.restoreAllMocks());

describe('scene-notes AI', () => {
  it('seedSceneNotes returns validated notes', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ notes: [
      { type: 'read_aloud', body: 'Candlelight gutters…' },
      { type: 'check', body: 'Spot the trapdoor', data: { skill: 'Perception', dc: 15 } },
      { type: 'trigger', body: 'If they pick the lock', data: { condition: 'pick the lock', dc: { skill: "Thieves' Tools", dc: 15 }, reveal: 'A click — the door swings.' } },
    ] }));
    const notes = await seedSceneNotes(CTX);
    expect(notes).toHaveLength(3);
    expect(notes[1].data).toMatchObject({ skill: 'Perception', dc: 15 });
  });

  it('does not pin a provider (fallback allowed)', async () => {
    const spy = vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ notes: [{ type: 'read_aloud', body: 'x' }] }));
    await seedSceneNotes(CTX);
    expect((spy.mock.calls[0]?.[1] ?? {}).forceProvider).toBeUndefined();
  });

  it('seedSceneNotes throws when the model returns zero notes', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('{"notes":[]}');
    await expect(seedSceneNotes(CTX)).rejects.toThrow(/could not be read/i);
  });

  it('draftNote returns one note of the asked type', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ type: 'tactic', body: 'Attacks only who it tracks' }));
    const n = await draftNote(CTX, 'tactic');
    expect(n.type).toBe('tactic');
    expect(n.body).toMatch(/tracks/);
  });

  it('suggestNotes returns ghost candidates', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ notes: [{ type: 'secret', body: 'Trapdoor escape' }] }));
    const ghosts = await suggestNotes(CTX, []);
    expect(ghosts[0].type).toBe('secret');
  });

  it('refineNote returns rewritten prose', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('Colder, sharper line.');
    const out = await refineNote('A warm line.', 'colder');
    expect(out).toBe('Colder, sharper line.');
  });

  it('throws readable error on malformed seed output', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('not json');
    await expect(seedSceneNotes(CTX)).rejects.toThrow(/could not be read/i);
  });
});
