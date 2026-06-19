// src/lib/sourcebook-openings/cos/__tests__/tarokka.test.ts
import { describe, it, expect } from 'vitest';
import { rollTarokka, type TarokkaReading } from '../tarokka';
import { ARTIFACT_LOCATIONS, ALLY_TABLE, STRAHD_TABLE } from '../tarokka-tables';

describe('rollTarokka', () => {
  it('produces exactly five draws in canonical slot order', () => {
    const r = rollTarokka('campaign-abc');
    expect(r.draws.map((d) => d.slot)).toEqual(['tome', 'holySymbol', 'sunsword', 'ally', 'strahd']);
  });

  it('is deterministic for the same seed', () => {
    const a = rollTarokka('seed-1');
    const b = rollTarokka('seed-1');
    expect(a).toEqual(b);
  });

  it('produces different readings for different seeds', () => {
    expect(rollTarokka('seed-1')).not.toEqual(rollTarokka('seed-2'));
  });

  it('resolves every draw to a value from its table', () => {
    const r = rollTarokka('seed-xyz');
    const artifacts = new Set(ARTIFACT_LOCATIONS.map((c) => c.resolution));
    const allies = new Set(ALLY_TABLE.map((c) => c.resolution));
    const strahd = new Set(STRAHD_TABLE.map((c) => c.resolution));
    const bySlot = Object.fromEntries(r.draws.map((d: TarokkaReading['draws'][number]) => [d.slot, d.location]));
    expect(artifacts.has(bySlot.tome!)).toBe(true);
    expect(artifacts.has(bySlot.holySymbol!)).toBe(true);
    expect(artifacts.has(bySlot.sunsword!)).toBe(true);
    expect(allies.has(bySlot.ally!)).toBe(true);
    expect(strahd.has(bySlot.strahd!)).toBe(true);
  });

  it('never hides two artifacts in the same location', () => {
    const r = rollTarokka('seed-dup');
    const artifactLocs = r.draws.filter((d) => ['tome', 'holySymbol', 'sunsword'].includes(d.slot)).map((d) => d.location);
    expect(new Set(artifactLocs).size).toBe(3);
  });
});
