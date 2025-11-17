'use client';

import { useState } from 'react';
import { Button, Flex, Text } from '@radix-ui/themes';
import { Dice5 } from 'lucide-react';
import DiceTray3D from './DiceTray3D';

type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

interface RollResult {
  id: number;
  dice: DiceType;
  count: number;
  modifier: number;
  rolls: number[];
  total: number;
  timestamp: Date;
}

const diceMax: Record<DiceType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
};

function rollOnce(max: number) {
  return Math.floor(Math.random() * max) + 1;
}

export function DiceRoller() {
  const [dice, setDice] = useState<DiceType>('d20');
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [results, setResults] = useState<RollResult[]>([]);
  const [activeRollDice, setActiveRollDice] = useState<number[]>([]);
  const [trayTrigger, setTrayTrigger] = useState(0);

  function handleRoll() {
    const sides = diceMax[dice];
    const safeCount = Math.min(Math.max(count, 1), 10);
    const rolls = Array.from({ length: safeCount }, () => rollOnce(sides));
    const sum = rolls.reduce((acc, value) => acc + value, 0);
    const total = sum + modifier;

    const result: RollResult = {
      id: Date.now(),
      dice,
      count: safeCount,
      modifier,
      rolls,
      total,
      timestamp: new Date(),
    };

    setResults((prev) => [result, ...prev].slice(0, 20));
    setShakeKey((prev) => prev + 1);
    setActiveRollDice(rolls);
    setTrayTrigger((prev) => prev + 1);
  }

  function parseNumber(value: string, fallback: number) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  }

  const currentResult = results[0];

  return (
    <div className="relative bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-md max-w-xl w-full overflow-hidden">
      <DiceTray3D dice={dice} rolls={activeRollDice} trigger={trayTrigger} />

      <Flex align="center" justify="between" mb="4" gap="3">
        <Flex align="center" gap="2">
          <Dice5 className="text-purple-400" size={20} />
          <Text size="3" weight="bold">
            Dice Roller
          </Text>
        </Flex>
        <Text size="1" color="gray">
          Click roll to shake the dice
        </Text>
      </Flex>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="col-span-2 md:col-span-2">
          <Text as="div" size="1" color="gray" className="mb-1">
            Dice
          </Text>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(diceMax) as DiceType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDice(type)}
                className={`px-2 py-1 rounded-md text-xs font-medium border ${
                  dice === type
                    ? 'bg-purple-600/80 border-purple-400 text-white shadow'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:border-purple-500 hover:text-white'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Text as="div" size="1" color="gray">
            Count
          </Text>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(event) => setCount(parseNumber(event.target.value, 1))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-1">
          <Text as="div" size="1" color="gray">
            Modifier
          </Text>
          <input
            type="number"
            value={modifier}
            onChange={(event) =>
              setModifier(parseNumber(event.target.value, 0))
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <Flex align="center" justify="between" mb="4" gap="3">
        <Button
          size="3"
          onClick={handleRoll}
          style={{
            backgroundColor: '#9333ea',
            color: 'white',
            flexShrink: 0,
          }}
        >
          Roll Dice
        </Button>

        {currentResult && (
          <div className="flex-1 text-right">
            <Text size="1" color="gray">
              Last roll
            </Text>
            <div className="text-sm font-medium text-zinc-100">
              {currentResult.count}
              {currentResult.dice}
              {currentResult.modifier !== 0
                ? currentResult.modifier > 0
                  ? ` + ${currentResult.modifier}`
                  : ` - ${Math.abs(currentResult.modifier)}`
                : ''}{' '}
              ={' '}
              <span className="text-purple-300 text-base">
                {currentResult.total}
              </span>
            </div>
          </div>
        )}
      </Flex>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full max-h-40 overflow-y-auto scrollbar-thin border border-zinc-800/80 rounded-lg bg-zinc-950/60 p-2 text-xs">
          {results.length === 0 ? (
            <Text size="1" color="gray">
              Roll some dice to see history.
            </Text>
          ) : (
            <ul className="space-y-1">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="flex items-center justify-between text-zinc-200"
                >
                  <span className="font-mono">
                    {result.count}
                    {result.dice}
                    {result.modifier !== 0
                      ? result.modifier > 0
                        ? `+${result.modifier}`
                        : result.modifier
                      : ''}{' '}
                    → [{result.rolls.join(', ')}]
                  </span>
                  <span className="font-semibold text-purple-300 ml-2">
                    {result.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiceRoller;
