export type DiceRoll = {
  notation: string;
  label?: string;
  rolls: number[];
  modifier: number;
  total: number;
  dieType: number;
  isCritical?: boolean;
  isFumble?: boolean;
};

const DICE_NOTATION = /^(\d*)d(\d+)([+-]\d+)?$/i;

export function parseNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const clean = notation.replace(/\s+/g, '').toLowerCase();
  const match = clean.match(DICE_NOTATION);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(`Invalid dice count in notation: ${notation}`);
  }
  if (!Number.isFinite(sides) || sides <= 1) {
    throw new Error(`Invalid die sides in notation: ${notation}`);
  }

  return { count, sides, modifier };
}

export function rollDice(notation: string, label?: string): DiceRoll {
  const { count, sides, modifier } = parseNotation(notation);
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((acc, n) => acc + n, 0);
  const total = sum + modifier;

  const isD20Single = sides === 20 && count === 1;
  const first = rolls[0] ?? 0;

  return {
    notation,
    label,
    rolls,
    modifier,
    total,
    dieType: sides,
    isCritical: isD20Single && first === 20,
    isFumble: isD20Single && first === 1,
  };
}

