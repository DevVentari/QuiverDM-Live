import { describe, it, expect } from 'vitest';
import { resolveDiscordVoiceToCharacter, type IdentityDb } from '../identity';

/** Build a fake IdentityDb from plain fixtures; records upserts for assertions. */
function makeDb(opts: {
  mapping?: { characterId: string | null; characterName: string; isDM: boolean } | null;
  account?: { userId: string; user: { name: string | null } | null } | null;
  member?: { role: string } | null;
  activeCharacter?: { character: { id: string; name: string } } | null;
}) {
  const upserts: Array<Record<string, unknown>> = [];
  const db: IdentityDb = {
    speakerMapping: {
      findUnique: async () => opts.mapping ?? null,
      upsert: async (args) => {
        upserts.push(args.create);
        return args.create;
      },
    },
    account: { findUnique: async () => opts.account ?? null },
    campaignMember: { findUnique: async () => opts.member ?? null },
    campaignCharacter: { findFirst: async () => opts.activeCharacter ?? null },
  };
  return { db, upserts };
}

describe('resolveDiscordVoiceToCharacter', () => {
  it('honours an existing (DM-overridden) mapping without touching accounts', async () => {
    const { db, upserts } = makeDb({
      mapping: { characterId: 'char-1', characterName: 'Kira the Bold', isDM: false },
    });
    const r = await resolveDiscordVoiceToCharacter('camp-1', 'disc-1', {}, db);
    expect(r.characterName).toBe('Kira the Bold');
    expect(r.characterId).toBe('char-1');
    expect(upserts).toHaveLength(0); // existing mapping is authoritative
  });

  it('resolves a linked player to their active character and persists the mapping', async () => {
    const { db, upserts } = makeDb({
      account: { userId: 'user-1', user: { name: 'Blake' } },
      member: { role: 'PLAYER' },
      activeCharacter: { character: { id: 'char-9', name: 'Mira Stormcrow' } },
    });
    const r = await resolveDiscordVoiceToCharacter('camp-1', 'disc-1', {}, db);
    expect(r).toMatchObject({
      characterName: 'Mira Stormcrow',
      characterId: 'char-9',
      userId: 'user-1',
      isDM: false,
    });
    expect(upserts[0]).toMatchObject({ speakerLabel: 'disc-1', characterName: 'Mira Stormcrow' });
  });

  it('labels a DM with no character as the DM (by display name)', async () => {
    const { db } = makeDb({
      account: { userId: 'user-dm', user: { name: 'Blake' } },
      member: { role: 'OWNER' },
      activeCharacter: null,
    });
    const r = await resolveDiscordVoiceToCharacter('camp-1', 'disc-dm', {}, db);
    expect(r.isDM).toBe(true);
    expect(r.characterId).toBeNull();
    expect(r.characterName).toBe('Blake'); // falls back to display name, not "Speaker"
  });

  it('returns the fallback label for an unlinked Discord user and does not persist', async () => {
    const { db, upserts } = makeDb({ account: null });
    const r = await resolveDiscordVoiceToCharacter('camp-1', 'disc-x', { fallbackLabel: 'Speaker 3' }, db);
    expect(r).toMatchObject({ characterName: 'Speaker 3', characterId: null, userId: null, isDM: false });
    expect(upserts).toHaveLength(0); // never pollute the mapping table with unknowns
  });

  it('respects persist:false (resolve without writing)', async () => {
    const { db, upserts } = makeDb({
      account: { userId: 'user-1', user: { name: 'Blake' } },
      member: { role: 'PLAYER' },
      activeCharacter: { character: { id: 'char-9', name: 'Mira' } },
    });
    const r = await resolveDiscordVoiceToCharacter('camp-1', 'disc-1', { persist: false }, db);
    expect(r.characterName).toBe('Mira');
    expect(upserts).toHaveLength(0);
  });
});
