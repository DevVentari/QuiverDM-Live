'use client';

import { useEffect } from 'react';
import { DiceType, getUpwardFaceValue } from '@/lib/dice-physics';

// Temporarily stubbed due to @react-three/drei build issues with Next.js 15
// TODO: Re-enable when three.js build issues are resolved

interface DieToRoll {
  type: DiceType;
  id: string;
}

interface PhysicsDiceTrayProps {
  diceToRoll?: DieToRoll[];
  onRollComplete?: (results: { id: string; value: number }[]) => void;
  rolling?: boolean;
}

export function PhysicsDiceTray({ diceToRoll = [], onRollComplete, rolling }: PhysicsDiceTrayProps) {
  // Simulate dice rolling when rolling becomes true
  useEffect(() => {
    if (rolling && diceToRoll.length > 0 && onRollComplete) {
      // Simulate a brief delay for the "roll"
      const timer = setTimeout(() => {
        const results = diceToRoll.map(die => ({
          id: die.id,
          value: getUpwardFaceValue(die.type),
        }));
        onRollComplete(results);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [rolling, diceToRoll, onRollComplete]);

  return (
    <div className="w-full h-64 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 border border-zinc-700">
      <div className="text-center">
        <p className="mb-2">3D Dice Tray temporarily disabled</p>
        {rolling && <p className="text-purple-400 animate-pulse">Rolling...</p>}
        {!rolling && diceToRoll.length > 0 && (
          <p className="text-xs">Click Roll to simulate dice</p>
        )}
      </div>
    </div>
  );
}

export default PhysicsDiceTray;
