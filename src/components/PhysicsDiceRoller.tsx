'use client';

import { useState, useCallback } from 'react';
import { Button, Flex, Text, Badge } from '@radix-ui/themes';
import { Dice5, RotateCcw, Plus, Minus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { DiceType, diceColors } from '@/lib/dice-physics';

// Dynamically import the 3D component to avoid SSR issues
const PhysicsDiceTray = dynamic(() => import('./PhysicsDiceTray'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 md:h-80 bg-slate-900/50 rounded-xl border border-slate-700 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Loading 3D engine...</p>
    </div>
  ),
});

interface DieToRoll {
  type: DiceType;
  id: string;
}

interface RollResult {
  id: string;
  timestamp: Date;
  dice: DieToRoll[];
  results: { id: string; value: number }[];
  modifier: number;
  total: number;
}

const diceTypes: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

export function PhysicsDiceRoller() {
  const [selectedDice, setSelectedDice] = useState<Map<DiceType, number>>(new Map([['d20', 1]]));
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [currentDice, setCurrentDice] = useState<DieToRoll[]>([]);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [currentResult, setCurrentResult] = useState<RollResult | null>(null);

  const addDie = (type: DiceType) => {
    setSelectedDice(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(type) || 0;
      if (current < 10) {
        newMap.set(type, current + 1);
      }
      return newMap;
    });
  };

  const removeDie = (type: DiceType) => {
    setSelectedDice(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(type) || 0;
      if (current > 0) {
        if (current === 1) {
          newMap.delete(type);
        } else {
          newMap.set(type, current - 1);
        }
      }
      return newMap;
    });
  };

  const clearDice = () => {
    setSelectedDice(new Map());
  };

  const handleRoll = useCallback(() => {
    if (rolling) return;

    const diceToRoll: DieToRoll[] = [];
    let idCounter = 0;

    selectedDice.forEach((count, type) => {
      for (let i = 0; i < count; i++) {
        diceToRoll.push({
          type,
          id: `${type}-${idCounter++}-${Date.now()}`,
        });
      }
    });

    if (diceToRoll.length === 0) {
      return;
    }

    setCurrentDice(diceToRoll);
    setRolling(true);
    setCurrentResult(null);
  }, [selectedDice, rolling]);

  const handleRollComplete = useCallback((results: { id: string; value: number }[]) => {
    const sum = results.reduce((acc, r) => acc + r.value, 0);
    const total = sum + modifier;

    const result: RollResult = {
      id: `roll-${Date.now()}`,
      timestamp: new Date(),
      dice: currentDice,
      results,
      modifier,
      total,
    };

    setCurrentResult(result);
    setHistory(prev => [result, ...prev].slice(0, 20));
    setRolling(false);
  }, [currentDice, modifier]);

  const getTotalDiceCount = () => {
    let count = 0;
    selectedDice.forEach(value => {
      count += value;
    });
    return count;
  };

  const getDiceNotation = () => {
    const parts: string[] = [];
    diceTypes.forEach(type => {
      const count = selectedDice.get(type) || 0;
      if (count > 0) {
        parts.push(`${count}${type}`);
      }
    });
    if (parts.length === 0) return 'No dice selected';
    let notation = parts.join(' + ');
    if (modifier !== 0) {
      notation += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }
    return notation;
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-md max-w-4xl w-full">
      <Flex align="center" justify="between" mb="4" gap="3">
        <Flex align="center" gap="2">
          <Dice5 className="text-purple-400" size={24} />
          <Text size="4" weight="bold">
            Physics Dice Roller
          </Text>
        </Flex>
        <Badge color="purple" variant="soft" size="2">
          3D Physics
        </Badge>
      </Flex>

      {/* Dice Selection */}
      <div className="mb-4">
        <Text as="div" size="2" color="gray" className="mb-2">
          Select Dice
        </Text>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {diceTypes.map(type => {
            const count = selectedDice.get(type) || 0;
            return (
              <div
                key={type}
                className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-2 flex flex-col items-center gap-1"
              >
                <Text
                  size="2"
                  weight="bold"
                  style={{ color: diceColors[type] }}
                >
                  {type.toUpperCase()}
                </Text>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => removeDie(type)}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                    disabled={count === 0}
                  >
                    <Minus size={14} />
                  </button>
                  <Text size="3" weight="bold" className="w-6 text-center">
                    {count}
                  </Text>
                  <button
                    type="button"
                    onClick={() => addDie(type)}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                    disabled={count >= 10}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modifier */}
      <div className="mb-4">
        <Text as="div" size="2" color="gray" className="mb-2">
          Modifier
        </Text>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModifier(prev => prev - 1)}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            value={modifier}
            onChange={e => setModifier(parseInt(e.target.value) || 0)}
            className="w-20 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-center font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => setModifier(prev => prev + 1)}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={clearDice}
            className="ml-auto p-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white"
            title="Clear all dice"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Roll Info */}
      <div className="mb-4 bg-zinc-950/60 rounded-lg p-3 border border-zinc-800">
        <Text size="2" color="gray">
          Current Roll:
        </Text>
        <Text size="3" weight="bold" className="font-mono">
          {getDiceNotation()}
        </Text>
      </div>

      {/* 3D Dice Tray */}
      <div className="mb-4">
        <PhysicsDiceTray
          diceToRoll={currentDice}
          onRollComplete={handleRollComplete}
          rolling={rolling}
        />
      </div>

      {/* Roll Button & Result */}
      <Flex align="center" justify="between" mb="4" gap="3">
        <Button
          size="3"
          onClick={handleRoll}
          disabled={rolling || getTotalDiceCount() === 0}
          style={{
            backgroundColor: rolling ? '#6b21a8' : '#9333ea',
            color: 'white',
            flexShrink: 0,
            opacity: rolling || getTotalDiceCount() === 0 ? 0.6 : 1,
          }}
        >
          {rolling ? 'Rolling...' : 'Roll Dice'}
        </Button>

        {currentResult && (
          <div className="flex-1 text-right">
            <Text size="1" color="gray">
              Result
            </Text>
            <div className="text-sm font-medium text-zinc-100">
              [{currentResult.results.map(r => r.value).join(', ')}]
              {currentResult.modifier !== 0
                ? currentResult.modifier > 0
                  ? ` + ${currentResult.modifier}`
                  : ` - ${Math.abs(currentResult.modifier)}`
                : ''}{' '}
              ={' '}
              <span className="text-purple-300 text-xl font-bold">
                {currentResult.total}
              </span>
            </div>
          </div>
        )}
      </Flex>

      {/* History */}
      <div className="max-h-40 overflow-y-auto scrollbar-thin border border-zinc-800/80 rounded-lg bg-zinc-950/60 p-2 text-xs">
        {history.length === 0 ? (
          <Text size="1" color="gray">
            Roll history will appear here.
          </Text>
        ) : (
          <ul className="space-y-1">
            {history.map(result => (
              <li
                key={result.id}
                className="flex items-center justify-between text-zinc-200"
              >
                <span className="font-mono">
                  {result.dice
                    .reduce((acc, die) => {
                      const existing = acc.find(d => d.type === die.type);
                      if (existing) {
                        existing.count++;
                      } else {
                        acc.push({ type: die.type, count: 1 });
                      }
                      return acc;
                    }, [] as { type: DiceType; count: number }[])
                    .map(d => `${d.count}${d.type}`)
                    .join('+')}
                  {result.modifier !== 0
                    ? result.modifier > 0
                      ? `+${result.modifier}`
                      : result.modifier
                    : ''}{' '}
                  → [{result.results.map(r => r.value).join(', ')}]
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
  );
}

export default PhysicsDiceRoller;
