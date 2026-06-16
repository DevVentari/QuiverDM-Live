import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScene, type SceneContext } from '../generate-scene';
import * as chat from '../chat';

const CONTEXT: SceneContext = {
  intent: 'Party reaches the castle gates at dusk; Strahd watches unseen.',
  mood: 'theatre',
  tagged: [{ id: 'e1', name: 'Strahd', type: 'NPC', description: 'The vampire lord.', statSummary: 'CR 15' }],
  party: [{ name: 'Tharivol', summary: 'Elf wizard, lvl 7' }],
  campaignName: 'Curse of Strahd',
};

const VALID = JSON.stringify({
  title: 'The Gates of Ravenloft',
  type: 'theatre',
  readAloud: 'The portcullis groans...',
  dmNotes: 'Strahd is testing them.',
  musicCue: 'low dread strings',
  suggestedChecks: [{ skill: 'Perception', dc: 15, note: 'Spot the watcher.' }],
  entityBeats: { e1: { wantsInScene: 'Measure the party', secret: 'He already knows their names' } },
});

beforeEach(() => vi.restoreAllMocks());

describe('generateScene', () => {
  it('parses and validates a well-formed model response', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(VALID);
    const result = await generateScene(CONTEXT);
    expect(result.title).toBe('The Gates of Ravenloft');
    expect(result.suggestedChecks[0].dc).toBe(15);
    expect(result.entityBeats.e1.secret).toContain('names');
  });

  it('tolerates code fences around the JSON', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('```json\n' + VALID + '\n```');
    const result = await generateScene(CONTEXT);
    expect(result.type).toBe('theatre');
  });

  it('throws a readable error on malformed output', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('the vision faded');
    await expect(generateScene(CONTEXT)).rejects.toThrow(/could not be read/i);
  });

  it('throws when the JSON is well-formed but fails the schema', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ title: 'X', type: 'not-a-real-type' }));
    await expect(generateScene(CONTEXT)).rejects.toThrow(/could not be read/i);
  });
});
