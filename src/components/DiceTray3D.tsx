'use client';

// Temporarily stubbed due to @react-three/drei build issues with Next.js 15
// TODO: Re-enable when three.js build issues are resolved

type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

interface DiceTray3DProps {
  dice: DiceType;
  rolls: number[];
  trigger: number;
}

export function DiceTray3D({ dice, rolls, trigger }: DiceTray3DProps) {
  return (
    <div className="w-full h-48 bg-zinc-800/50 rounded-lg flex items-center justify-center text-zinc-500 mb-4">
      3D Dice temporarily disabled
    </div>
  );
}

export default DiceTray3D;
