import { Text } from '@radix-ui/themes';
import PhysicsDiceRoller from '@/components/PhysicsDiceRoller';

export default function DiceTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-10">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Text size="5" weight="bold">
              Physics Dice Roller
            </Text>
            <Text size="2" color="gray">
              Full 3D physics simulation - dice determine results by landing
            </Text>
          </div>
          <div className="hidden md:flex flex-col items-end text-xs text-zinc-400">
            <span>QuiverDM • Sandbox</span>
            <span>Physics-driven dice rolling</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Character sheet sidebar */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
              <Text size="3" weight="bold" className="mb-2">
                Character
              </Text>
              <div className="space-y-2 text-sm text-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Name</span>
                  <span className="font-medium">Prototype Hero</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Class / Level</span>
                  <span className="font-medium">Fighter 5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">AC</span>
                  <span className="font-medium">17</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">HP</span>
                  <span className="font-medium">42 / 42</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
              <Text size="3" weight="bold" className="mb-3">
                Ability Scores
              </Text>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                {[
                  ['STR', 16, '+3'],
                  ['DEX', 14, '+2'],
                  ['CON', 16, '+3'],
                  ['INT', 10, '+0'],
                  ['WIS', 12, '+1'],
                  ['CHA', 8, '-1'],
                ].map(([label, score, mod]) => (
                  <div
                    key={label as string}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 flex flex-col items-center gap-1"
                  >
                    <span className="text-xs text-zinc-400">{label}</span>
                    <span className="text-lg font-semibold text-zinc-100">
                      {score}
                    </span>
                    <span className="text-xs text-purple-300 font-mono">
                      {mod}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
              <Text size="3" weight="bold" className="mb-2">
                How It Works
              </Text>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li>
                  <strong className="text-zinc-200">Physics Simulation:</strong> Dice are thrown with random velocity and spin
                </li>
                <li>
                  <strong className="text-zinc-200">Face Detection:</strong> When dice settle, the upward-facing side is calculated using quaternion math
                </li>
                <li>
                  <strong className="text-zinc-200">No Cheating:</strong> Results are determined entirely by physics, not pre-calculated
                </li>
              </ul>
            </div>
          </aside>

          {/* Dice roller + sample actions */}
          <main className="lg:col-span-2 space-y-4">
            <PhysicsDiceRoller />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
                <Text size="3" weight="bold" className="mb-2">
                  Features
                </Text>
                <ul className="text-sm text-zinc-200 space-y-1">
                  <li>• Mix multiple dice types (d4-d20)</li>
                  <li>• Add modifiers to total</li>
                  <li>• Watch dice physically roll and settle</li>
                  <li>• Results determined by physics</li>
                  <li>• Roll history tracking</li>
                </ul>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
                <Text size="3" weight="bold" className="mb-2">
                  Technical Notes
                </Text>
                <p className="text-xs text-zinc-400">
                  Uses React Three Fiber with Rapier physics engine. Face
                  detection works by transforming face normals through the
                  die&apos;s rotation quaternion and finding which normal aligns
                  most with the world up vector.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

