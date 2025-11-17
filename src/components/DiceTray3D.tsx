'use client';

import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { useMemo } from 'react';

type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

interface DiceTray3DProps {
  dice: DiceType;
  rolls: number[];
  trigger: number;
}

interface DieInstance {
  id: string;
  index: number;
  value: number;
}

const diceColor: Record<DiceType, string> = {
  d4: '#22c55e',
  d6: '#eab308',
  d8: '#06b6d4',
  d10: '#f97316',
  d12: '#a855f7',
  d20: '#ef4444',
};

function DiceTrayEnvironment() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  );
}

function TrayBounds() {
  const floorSize: [number, number, number] = [14, 0.5, 10];

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={floorSize} position={[0, -0.5, 0]} />
      <CuboidCollider args={[floorSize[0], 1, 0.5]} position={[0, 0.5, -floorSize[2]]} />
      <CuboidCollider args={[floorSize[0], 1, 0.5]} position={[0, 0.5, floorSize[2]]} />
      <CuboidCollider args={[0.5, 1, floorSize[2]]} position={[-floorSize[0], 0.5, 0]} />
      <CuboidCollider args={[0.5, 1, floorSize[2]]} position={[floorSize[0], 0.5, 0]} />
    </RigidBody>
  );
}

interface DieRigidBodyProps {
  type: DiceType;
  instance: DieInstance;
  total: number;
  count: number;
}

function DieRigidBody({ type, instance }: DieRigidBodyProps) {
  const size = 0.7;
  const xOffset = (instance.index - (instance.value - 1) / 2) * 1.4;

  return (
    <RigidBody
      colliders="hull"
      position={[xOffset, 6 + instance.index * 0.3, -3 + instance.index * 0.2]}
      rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
      linearVelocity={[6 + Math.random() * 6, 2 + Math.random() * 4, 6 + Math.random() * 4]}
      angularVelocity={[
        4 + Math.random() * 4,
        4 + Math.random() * 4,
        4 + Math.random() * 4,
      ]}
      restitution={0.3}
      friction={1}
    >
      <mesh castShadow receiveShadow>
        {type === 'd4' && <tetrahedronGeometry args={[size]} />}
        {type === 'd6' && <boxGeometry args={[size, size, size]} />}
        {type === 'd8' && <octahedronGeometry args={[size]} />}
        {type === 'd10' && <cylinderGeometry args={[size * 0.9, size * 0.9, size * 1.6, 10]} />}
        {type === 'd12' && <dodecahedronGeometry args={[size]} />}
        {type === 'd20' && <icosahedronGeometry args={[size]} />}
        <meshStandardMaterial
          color={diceColor[type]}
          metalness={0.25}
          roughness={0.35}
          emissive="#0f172a"
          emissiveIntensity={0.2}
        />
      </mesh>
      <Html center distanceFactor={12}>
        <div className="px-2 py-1 rounded-full bg-black/70 border border-white/20 text-xs font-semibold text-white shadow-lg">
          {instance.value}
        </div>
      </Html>
    </RigidBody>
  );
}

export function DiceTray3D({ dice, rolls, trigger }: DiceTray3DProps) {
  const instances: DieInstance[] = useMemo(
    () =>
      rolls.map((value, index) => ({
        id: `${trigger}-${index}`,
        index,
        value,
      })),
    [rolls, trigger],
  );

  if (rolls.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      <Canvas
        shadows
        camera={{ position: [0, 10, 16], fov: 40 }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['transparent']} />
        <group position={[0, 0, 0]}>
          <DiceTrayEnvironment />
          <Physics key={trigger} gravity={[0, -30, 0]}>
            <TrayBounds />
            {instances.map((instance) => (
              <DieRigidBody
                key={instance.id}
                type={dice}
                instance={instance}
                total={rolls.reduce((sum, value) => sum + value, 0)}
                count={rolls.length}
              />
            ))}
          </Physics>
        </group>
        <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI / 2.4} />
      </Canvas>
    </div>
  );
}

export default DiceTray3D;

