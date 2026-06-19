// src/lib/sourcebook-openings/cos/tarokka.ts
import { makeRng } from '../tarokka';
import { ARTIFACT_LOCATIONS, ALLY_TABLE, STRAHD_TABLE, type CardEntry } from './tarokka-tables';

export type TarokkaSlot = 'tome' | 'holySymbol' | 'sunsword' | 'ally' | 'strahd';

export interface TarokkaDraw {
  slot: TarokkaSlot;
  label: string;
  card: string;
  location: string;
}
export interface TarokkaReading {
  seed: string;
  draws: TarokkaDraw[];
}

const LABELS: Record<TarokkaSlot, string> = {
  tome: 'Tome of Strahd',
  holySymbol: 'Holy Symbol of Ravenkind',
  sunsword: 'The Sunsword',
  ally: 'The Fortune-favoured ally',
  strahd: "Strahd's final stand",
};

/**
 * Draw without replacement from a table. The optional `used` set tracks
 * resolutions already drawn (shared across the three artifact draws). A depleted
 * pool is a programming error — fail fast rather than silently re-drawing a dupe.
 */
function drawUnique(rng: () => number, table: readonly CardEntry[], used = new Set<string>()): CardEntry {
  const available = table.filter((c) => !used.has(c.resolution));
  if (available.length === 0) throw new Error('drawUnique: pool exhausted');
  const choice = available[Math.floor(rng() * available.length)]!;
  used.add(choice.resolution);
  return choice;
}

/** Roll Madam Eva's five-card reading. Seed defaults to the campaign id at the call site. */
export function rollTarokka(seed: string): TarokkaReading {
  const rng = makeRng(seed);
  // The three artifacts share one used-set so no two hide in the same location.
  const usedArtifactLocs = new Set<string>();
  const tome = drawUnique(rng, ARTIFACT_LOCATIONS, usedArtifactLocs);
  const holySymbol = drawUnique(rng, ARTIFACT_LOCATIONS, usedArtifactLocs);
  const sunsword = drawUnique(rng, ARTIFACT_LOCATIONS, usedArtifactLocs);
  // Ally and Strahd draw from their own tables independently.
  const ally = drawUnique(rng, ALLY_TABLE);
  const strahd = drawUnique(rng, STRAHD_TABLE);

  const mk = (slot: TarokkaSlot, c: CardEntry): TarokkaDraw => ({
    slot, label: LABELS[slot], card: c.card, location: c.resolution,
  });
  return {
    seed,
    draws: [
      mk('tome', tome),
      mk('holySymbol', holySymbol),
      mk('sunsword', sunsword),
      mk('ally', ally),
      mk('strahd', strahd),
    ],
  };
}
