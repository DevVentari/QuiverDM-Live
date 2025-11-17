'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  DiceType,
  getUpwardFaceValue,
  isDiceSettled,
  diceColors
} from '@/lib/dice-physics';

interface PhysicsDiceTrayProps {
  diceToRoll: { type: DiceType; id: string }[];
  onRollComplete: (results: { id: string; value: number }[]) => void;
  rolling: boolean;
}

interface DieState {
  id: string;
  settled: boolean;
  value: number | null;
}

function TrayEnvironment() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 15, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-5, 10, -5]} intensity={0.5} />
    </>
  );
}

function TrayBounds() {
  const { viewport } = useThree();

  // Scale tray to viewport
  const width = Math.min(viewport.width * 0.8, 20);
  const depth = Math.min(viewport.height * 0.6, 14);
  const wallHeight = 3;
  const wallThickness = 0.5;

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, 0.25, depth / 2]} position={[0, -0.25, 0]} />
      </RigidBody>

      {/* Visible floor */}
      <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#1e1b4b"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Walls - invisible but solid */}
      <RigidBody type="fixed" colliders={false}>
        {/* Back wall */}
        <CuboidCollider
          args={[width / 2, wallHeight, wallThickness]}
          position={[0, wallHeight / 2, -depth / 2 - wallThickness]}
        />
        {/* Front wall */}
        <CuboidCollider
          args={[width / 2, wallHeight, wallThickness]}
          position={[0, wallHeight / 2, depth / 2 + wallThickness]}
        />
        {/* Left wall */}
        <CuboidCollider
          args={[wallThickness, wallHeight, depth / 2]}
          position={[-width / 2 - wallThickness, wallHeight / 2, 0]}
        />
        {/* Right wall */}
        <CuboidCollider
          args={[wallThickness, wallHeight, depth / 2]}
          position={[width / 2 + wallThickness, wallHeight / 2, 0]}
        />
      </RigidBody>
    </group>
  );
}

interface PhysicsDieProps {
  type: DiceType;
  id: string;
  index: number;
  total: number;
  onSettled: (id: string, value: number) => void;
}

function PhysicsDie({ type, id, index, total, onSettled }: PhysicsDieProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hasSettled, setHasSettled] = useState(false);
  const settleCheckCount = useRef(0);
  const lastCheckTime = useRef(0);

  // Calculate spawn position - spread dice out
  const spawnX = (index - (total - 1) / 2) * 2;
  const spawnY = 8 + Math.random() * 2;
  const spawnZ = -4 + Math.random() * 2;

  // Random initial rotation
  const initialRotation: [number, number, number] = [
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
  ];

  // Random throw velocity - towards center of tray
  const throwVelocity: [number, number, number] = [
    (Math.random() - 0.5) * 8,
    -2 + Math.random() * 2,
    6 + Math.random() * 4,
  ];

  const angularVelocity: [number, number, number] = [
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
  ];

  useFrame((state) => {
    if (hasSettled || !rigidBodyRef.current) return;

    const now = state.clock.elapsedTime;
    if (now - lastCheckTime.current < 0.1) return; // Check every 100ms
    lastCheckTime.current = now;

    const linVel = rigidBodyRef.current.linvel();
    const angVel = rigidBodyRef.current.angvel();

    if (isDiceSettled(linVel, angVel, 0.05)) {
      settleCheckCount.current++;

      // Require multiple consecutive checks to confirm settled
      if (settleCheckCount.current >= 10) {
        const rotation = rigidBodyRef.current.rotation();
        const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        const value = getUpwardFaceValue(type, quaternion);

        setHasSettled(true);
        onSettled(id, value);
      }
    } else {
      settleCheckCount.current = 0;
    }
  });

  const size = 0.8;

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders="hull"
      position={[spawnX, spawnY, spawnZ]}
      rotation={initialRotation}
      linearVelocity={throwVelocity}
      angularVelocity={angularVelocity}
      restitution={0.4}
      friction={0.8}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <mesh ref={meshRef} castShadow receiveShadow>
        {type === 'd4' && <tetrahedronGeometry args={[size * 1.2]} />}
        {type === 'd6' && <boxGeometry args={[size, size, size]} />}
        {type === 'd8' && <octahedronGeometry args={[size]} />}
        {type === 'd10' && <dodecahedronGeometry args={[size * 0.9]} />}
        {type === 'd12' && <dodecahedronGeometry args={[size]} />}
        {type === 'd20' && <icosahedronGeometry args={[size]} />}
        <meshStandardMaterial
          color={diceColors[type]}
          metalness={0.3}
          roughness={0.4}
          emissive={hasSettled ? diceColors[type] : '#000000'}
          emissiveIntensity={hasSettled ? 0.3 : 0}
        />
      </mesh>
    </RigidBody>
  );
}

function DiceScene({
  diceToRoll,
  onAllSettled,
  triggerKey
}: {
  diceToRoll: { type: DiceType; id: string }[];
  onAllSettled: (results: { id: string; value: number }[]) => void;
  triggerKey: number;
}) {
  const [dieStates, setDieStates] = useState<Map<string, DieState>>(new Map());
  const reportedRef = useRef(false);

  // Reset state when new roll starts
  useEffect(() => {
    const initialStates = new Map<string, DieState>();
    diceToRoll.forEach(die => {
      initialStates.set(die.id, { id: die.id, settled: false, value: null });
    });
    setDieStates(initialStates);
    reportedRef.current = false;
  }, [diceToRoll, triggerKey]);

  const handleDieSettled = useCallback((id: string, value: number) => {
    setDieStates(prev => {
      const newStates = new Map(prev);
      newStates.set(id, { id, settled: true, value });
      return newStates;
    });
  }, []);

  // Check if all dice have settled
  useEffect(() => {
    if (reportedRef.current) return;
    if (dieStates.size === 0) return;
    if (dieStates.size !== diceToRoll.length) return;

    const allSettled = Array.from(dieStates.values()).every(
      state => state.settled && state.value !== null
    );

    if (allSettled) {
      reportedRef.current = true;
      const results = Array.from(dieStates.values()).map(state => ({
        id: state.id,
        value: state.value!,
      }));
      onAllSettled(results);
    }
  }, [dieStates, diceToRoll.length, onAllSettled]);

  return (
    <Physics gravity={[0, -25, 0]}>
      <TrayBounds />
      {diceToRoll.map((die, index) => (
        <PhysicsDie
          key={`${die.id}-${triggerKey}`}
          type={die.type}
          id={die.id}
          index={index}
          total={diceToRoll.length}
          onSettled={handleDieSettled}
        />
      ))}
    </Physics>
  );
}

export function PhysicsDiceTray({ diceToRoll, onRollComplete, rolling }: PhysicsDiceTrayProps) {
  const [triggerKey, setTriggerKey] = useState(0);

  useEffect(() => {
    if (rolling && diceToRoll.length > 0) {
      setTriggerKey(prev => prev + 1);
    }
  }, [rolling, diceToRoll]);

  const handleAllSettled = useCallback((results: { id: string; value: number }[]) => {
    onRollComplete(results);
  }, [onRollComplete]);

  if (!rolling && triggerKey === 0) {
    return (
      <div className="w-full h-64 bg-slate-900/50 rounded-xl border border-slate-700 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Click Roll to throw dice</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 md:h-80 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      <Canvas
        shadows
        camera={{ position: [0, 12, 14], fov: 45 }}
        style={{ background: 'linear-gradient(to bottom, #0f172a, #1e1b4b)' }}
      >
        <TrayEnvironment />
        <DiceScene
          diceToRoll={diceToRoll}
          onAllSettled={handleAllSettled}
          triggerKey={triggerKey}
        />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={8}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

export default PhysicsDiceTray;
