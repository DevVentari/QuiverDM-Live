/**
 * D&D 5e Encounter Difficulty Calculator
 * Based on Dungeon Master's Guide p.82
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// XP thresholds per character per level (DMG p.82)
const XP_THRESHOLDS: Record<number, Record<Difficulty, number>> = {
  1:  { easy: 25,    medium: 50,    hard: 75,    deadly: 100 },
  2:  { easy: 50,    medium: 100,   hard: 150,   deadly: 200 },
  3:  { easy: 75,    medium: 150,   hard: 225,   deadly: 400 },
  4:  { easy: 125,   medium: 250,   hard: 375,   deadly: 500 },
  5:  { easy: 250,   medium: 500,   hard: 750,   deadly: 1100 },
  6:  { easy: 300,   medium: 600,   hard: 900,   deadly: 1400 },
  7:  { easy: 350,   medium: 750,   hard: 1100,  deadly: 1700 },
  8:  { easy: 450,   medium: 900,   hard: 1400,  deadly: 2100 },
  9:  { easy: 550,   medium: 1100,  hard: 1600,  deadly: 2400 },
  10: { easy: 600,   medium: 1200,  hard: 1900,  deadly: 2800 },
  11: { easy: 800,   medium: 1600,  hard: 2400,  deadly: 3600 },
  12: { easy: 1000,  medium: 2000,  hard: 3000,  deadly: 4500 },
  13: { easy: 1100,  medium: 2200,  hard: 3400,  deadly: 5100 },
  14: { easy: 1250,  medium: 2500,  hard: 3800,  deadly: 5700 },
  15: { easy: 1400,  medium: 2800,  hard: 4300,  deadly: 6400 },
  16: { easy: 1600,  medium: 3200,  hard: 4800,  deadly: 7200 },
  17: { easy: 2000,  medium: 3900,  hard: 5900,  deadly: 8800 },
  18: { easy: 2100,  medium: 4200,  hard: 6300,  deadly: 9500 },
  19: { easy: 2400,  medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800,  medium: 5700,  hard: 8500,  deadly: 12700 },
};

// XP by CR (DMG p.274)
export const CR_TO_XP: Record<string, number> = {
  '0':    10,
  '1/8':  25,
  '1/4':  50,
  '1/2':  100,
  '1':    200,
  '2':    450,
  '3':    700,
  '4':    1100,
  '5':    1800,
  '6':    2300,
  '7':    2900,
  '8':    3900,
  '9':    5000,
  '10':   5900,
  '11':   7200,
  '12':   8400,
  '13':   10000,
  '14':   11500,
  '15':   13000,
  '16':   15000,
  '17':   18000,
  '18':   20000,
  '19':   22000,
  '20':   25000,
  '21':   33000,
  '22':   41000,
  '23':   50000,
  '24':   62000,
  '25':   75000,
  '26':   90000,
  '27':   105000,
  '28':   120000,
  '29':   135000,
  '30':   155000,
};

/**
 * Get the encounter multiplier based on number of monsters and party size.
 * DMG p.82 — accounts for action economy advantage of multiple enemies.
 */
export function getEncounterMultiplier(creatureCount: number, partySize: number): number {
  let multiplier: number;

  if (creatureCount === 1) {
    multiplier = 1;
  } else if (creatureCount === 2) {
    multiplier = 1.5;
  } else if (creatureCount <= 6) {
    multiplier = 2;
  } else if (creatureCount <= 10) {
    multiplier = 2.5;
  } else if (creatureCount <= 14) {
    multiplier = 3;
  } else {
    multiplier = 4;
  }

  // Adjust for small or large parties
  if (partySize < 3) {
    // Small party: use next higher bracket
    if (multiplier === 1) multiplier = 1.5;
    else if (multiplier === 1.5) multiplier = 2;
    else if (multiplier === 2) multiplier = 2.5;
    else if (multiplier === 2.5) multiplier = 3;
    else if (multiplier === 3) multiplier = 4;
  } else if (partySize >= 6) {
    // Large party: use next lower bracket
    if (multiplier === 4) multiplier = 3;
    else if (multiplier === 3) multiplier = 2.5;
    else if (multiplier === 2.5) multiplier = 2;
    else if (multiplier === 2) multiplier = 1.5;
    else if (multiplier === 1.5) multiplier = 1;
  }

  return multiplier;
}

export interface XpBudget {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
  target: number; // budget for requested difficulty
}

/**
 * Calculate total XP budget for the party at the given difficulty.
 */
export function getXpBudget(partySize: number, partyLevel: number, difficulty: Difficulty): XpBudget {
  const level = Math.max(1, Math.min(20, partyLevel));
  const thresholds = XP_THRESHOLDS[level];

  return {
    easy:   thresholds.easy * partySize,
    medium: thresholds.medium * partySize,
    hard:   thresholds.hard * partySize,
    deadly: thresholds.deadly * partySize,
    target: thresholds[difficulty] * partySize,
  };
}

export interface DifficultyResult {
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly' | 'over-budget';
  rawXp: number;
  adjustedXp: number;
  multiplier: number;
  budgetUsedPercent: number;
}

/**
 * Calculate encounter difficulty from list of creatures.
 */
export function calculateDifficulty(
  creatures: Array<{ xp: number; count: number }>,
  partySize: number,
  partyLevel: number
): DifficultyResult {
  const level = Math.max(1, Math.min(20, partyLevel));
  const thresholds = XP_THRESHOLDS[level];

  const totalCreatures = creatures.reduce((sum, c) => sum + c.count, 0);
  const rawXp = creatures.reduce((sum, c) => sum + c.xp * c.count, 0);

  const multiplier = getEncounterMultiplier(totalCreatures, partySize);
  const adjustedXp = Math.round(rawXp * multiplier);

  const deadlyBudget = thresholds.deadly * partySize;

  let difficulty: DifficultyResult['difficulty'];
  if (adjustedXp === 0) {
    difficulty = 'trivial';
  } else if (adjustedXp < thresholds.easy * partySize) {
    difficulty = 'trivial';
  } else if (adjustedXp < thresholds.medium * partySize) {
    difficulty = 'easy';
  } else if (adjustedXp < thresholds.hard * partySize) {
    difficulty = 'medium';
  } else if (adjustedXp < deadlyBudget) {
    difficulty = 'hard';
  } else if (adjustedXp <= deadlyBudget * 1.5) {
    difficulty = 'deadly';
  } else {
    difficulty = 'over-budget';
  }

  const budgetUsedPercent = deadlyBudget > 0
    ? Math.round((adjustedXp / deadlyBudget) * 100)
    : 0;

  return { difficulty, rawXp, adjustedXp, multiplier, budgetUsedPercent };
}

/**
 * Get a suggested CR range for monsters that would fit the difficulty.
 * Returns min/max CR as numeric values.
 */
export function getCrRangeForDifficulty(
  partyLevel: number,
  difficulty: Difficulty
): { min: number; max: number } {
  // Rough rule of thumb: average monster CR ≈ party level - 2 for medium
  // Adjust by difficulty
  const adjustments: Record<Difficulty, { min: number; max: number }> = {
    easy:   { min: -4, max: -1 },
    medium: { min: -2, max: 1 },
    hard:   { min: -1, max: 2 },
    deadly: { min: 0,  max: 4 },
  };

  const adj = adjustments[difficulty];
  const baseLevel = Math.max(1, Math.min(20, partyLevel));

  return {
    min: Math.max(0, baseLevel + adj.min),
    max: Math.min(30, baseLevel + adj.max),
  };
}

/** Get XP for a CR string, returns 0 for unknown CR */
export function xpForCr(cr: string): number {
  return CR_TO_XP[cr] ?? 0;
}
