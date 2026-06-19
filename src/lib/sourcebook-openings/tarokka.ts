// src/lib/sourcebook-openings/tarokka.ts
/** Deterministic, seedable helpers shared by every sourcebook's Tarokka-style draw. */

/** xfnv1a string hash → 32-bit seed. */
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: returns a function yielding floats in [0, 1). */
export function makeRng(seed: string): () => number {
  let a = hashSeed(seed);
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element deterministically from the next RNG value. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: empty list');
  return items[Math.floor(rng() * items.length)]!;
}
