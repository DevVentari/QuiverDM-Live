// src/components/campaign/forge-state.ts
/** Pure derivation of campaign "forging" readiness from existing query results. */

/** Sourcebooks whose seed includes a Tarokka reading (matches the opening-config registry). */
export const BOOKS_WITH_TAROKKA = ['cos'] as const;

type SurfaceStatus = 'pending' | 'ready' | 'n/a';

export interface ForgeInputs {
  /** From scenes.list — only promptInput is read. */
  scenes: Array<{ promptInput?: unknown }>;
  /** Seeded NPC count (brain.entities.list type=NPC length). */
  npcCount: number;
  /** Party member count (members.getAll length). */
  partyCount: number;
  /** Linked sourcebook slug, or undefined for a blank-slate campaign. */
  book?: string;
  /** True once the mist's hard cap (~2.5s) has elapsed. */
  capReached: boolean;
}

export interface ForgingState {
  ready: number;
  total: number;
  surfaces: {
    session0: SurfaceStatus;
    tarokka: SurfaceStatus;
    npcs: SurfaceStatus;
    party: 'empty' | 'ready';
  };
  firstArtifactReady: boolean;
  allSettled: boolean;
}

function blueprintKeyOf(promptInput: unknown): string | null {
  if (promptInput && typeof promptInput === 'object' && !Array.isArray(promptInput)) {
    const p = promptInput as { seededBy?: unknown; blueprintKey?: unknown };
    if (p.seededBy === 'session0' && typeof p.blueprintKey === 'string') return p.blueprintKey;
  }
  return null;
}

export function deriveForgingState(input: ForgeInputs): ForgingState {
  const keys = input.scenes.map((s) => blueprintKeyOf(s.promptInput)).filter((k): k is string => !!k);
  const hasSeed = !!input.book;
  const expectsTarokka = !!input.book && (BOOKS_WITH_TAROKKA as readonly string[]).includes(input.book);

  const session0: SurfaceStatus = !hasSeed ? 'n/a'
    : keys.some((k) => k !== 'tarokka') ? 'ready' : 'pending';
  const tarokka: SurfaceStatus = !expectsTarokka ? 'n/a'
    : keys.includes('tarokka') ? 'ready' : 'pending';
  const npcs: SurfaceStatus = !hasSeed ? 'n/a'
    : input.npcCount > 0 ? 'ready' : 'pending';
  const party = input.partyCount > 0 ? 'ready' : 'empty';

  const seeded: SurfaceStatus[] = [session0, tarokka, npcs];
  const expected = seeded.filter((s) => s !== 'n/a');
  const readySeeded = expected.filter((s) => s === 'ready').length;

  const total = expected.length + 1;
  const ready = readySeeded + (party === 'ready' ? 1 : 0);

  const allSettled = expected.every((s) => s === 'ready');
  const firstArtifactReady = input.capReached || readySeeded > 0 || expected.length === 0;

  return {
    ready,
    total,
    surfaces: { session0, tarokka, npcs, party },
    firstArtifactReady,
    allSettled,
  };
}
