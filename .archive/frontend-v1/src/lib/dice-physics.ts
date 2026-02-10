// Temporarily stubbed due to three.js build issues with Next.js 15
// TODO: Re-enable when three.js build issues are resolved

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

export const diceColors: Record<DiceType, string> = {
  d4: '#22c55e',
  d6: '#eab308',
  d8: '#06b6d4',
  d10: '#f97316',
  d12: '#a855f7',
  d20: '#ef4444',
};

export interface FaceMapping {
  normal: { x: number; y: number; z: number };
  value: number;
}

export interface DiceRollResult {
  value: number;
  final: boolean;
}

export function createDiceGeometry(type: DiceType) {
  return null;
}

export function getUpwardFaceValue(type: DiceType): number {
  const maxValues: Record<DiceType, number> = {
    d4: 4,
    d6: 6,
    d8: 8,
    d10: 10,
    d12: 12,
    d20: 20,
  };
  const max = maxValues[type] || 6;
  return Math.floor(Math.random() * max) + 1;
}

export function rollDice(type: DiceType): DiceRollResult {
  return {
    value: getUpwardFaceValue(type),
    final: true,
  };
}
