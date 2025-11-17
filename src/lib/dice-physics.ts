import * as THREE from 'three';

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

export interface FaceMapping {
  normal: THREE.Vector3;
  value: number;
}

// D6 face mappings - standard die layout
// When a face normal points UP (positive Y), that's the result
const d6Faces: FaceMapping[] = [
  { normal: new THREE.Vector3(0, 1, 0), value: 1 },   // Top
  { normal: new THREE.Vector3(0, -1, 0), value: 6 },  // Bottom (opposite of 1)
  { normal: new THREE.Vector3(1, 0, 0), value: 2 },   // Right
  { normal: new THREE.Vector3(-1, 0, 0), value: 5 },  // Left (opposite of 2)
  { normal: new THREE.Vector3(0, 0, 1), value: 3 },   // Front
  { normal: new THREE.Vector3(0, 0, -1), value: 4 },  // Back (opposite of 3)
];

// D4 - Tetrahedron
// D4 is special: the value is on the BOTTOM face (point up), or read from edges
// We'll use point-down orientation where the flat face on top shows the value
const d4Faces: FaceMapping[] = (() => {
  const faces: FaceMapping[] = [];
  const geometry = new THREE.TetrahedronGeometry(1);
  geometry.computeVertexNormals();

  // Tetrahedron has 4 faces, we need their normals
  // Standard tetrahedron in Three.js has specific orientation
  const sqrt2 = Math.sqrt(2);
  const sqrt6 = Math.sqrt(6);

  // These are the face normals for a regular tetrahedron
  faces.push({ normal: new THREE.Vector3(0, 1, 0).normalize(), value: 4 });
  faces.push({ normal: new THREE.Vector3(0, -1/3, sqrt2*2/3).normalize(), value: 1 });
  faces.push({ normal: new THREE.Vector3(-sqrt6/3, -1/3, -sqrt2/3).normalize(), value: 2 });
  faces.push({ normal: new THREE.Vector3(sqrt6/3, -1/3, -sqrt2/3).normalize(), value: 3 });

  return faces;
})();

// D8 - Octahedron
const d8Faces: FaceMapping[] = (() => {
  const faces: FaceMapping[] = [];
  // Octahedron has 8 triangular faces
  // Normals point to corners of a cube
  const n = 1 / Math.sqrt(3);

  faces.push({ normal: new THREE.Vector3(n, n, n), value: 1 });
  faces.push({ normal: new THREE.Vector3(n, n, -n), value: 2 });
  faces.push({ normal: new THREE.Vector3(n, -n, n), value: 3 });
  faces.push({ normal: new THREE.Vector3(n, -n, -n), value: 4 });
  faces.push({ normal: new THREE.Vector3(-n, n, n), value: 5 });
  faces.push({ normal: new THREE.Vector3(-n, n, -n), value: 6 });
  faces.push({ normal: new THREE.Vector3(-n, -n, n), value: 7 });
  faces.push({ normal: new THREE.Vector3(-n, -n, -n), value: 8 });

  return faces;
})();

// D10 - Pentagonal Trapezohedron (approximated with cylinder for now)
// Real d10 has 10 kite-shaped faces
const d10Faces: FaceMapping[] = (() => {
  const faces: FaceMapping[] = [];
  // For a proper d10, faces alternate around the equator
  // We'll create 10 faces with normals pointing outward at angles
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10;
    const tilt = i % 2 === 0 ? 0.3 : -0.3; // Alternate up/down tilt
    const normal = new THREE.Vector3(
      Math.cos(angle),
      tilt,
      Math.sin(angle)
    ).normalize();
    faces.push({ normal, value: i });
  }
  return faces;
})();

// D12 - Dodecahedron
const d12Faces: FaceMapping[] = (() => {
  const faces: FaceMapping[] = [];
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

  // Dodecahedron face normals (pointing to face centers)
  // These are perpendicular to the pentagonal faces
  const normals = [
    new THREE.Vector3(0, phi, 1),
    new THREE.Vector3(0, phi, -1),
    new THREE.Vector3(0, -phi, 1),
    new THREE.Vector3(0, -phi, -1),
    new THREE.Vector3(1, 0, phi),
    new THREE.Vector3(-1, 0, phi),
    new THREE.Vector3(1, 0, -phi),
    new THREE.Vector3(-1, 0, -phi),
    new THREE.Vector3(phi, 1, 0),
    new THREE.Vector3(phi, -1, 0),
    new THREE.Vector3(-phi, 1, 0),
    new THREE.Vector3(-phi, -1, 0),
  ];

  normals.forEach((normal, i) => {
    faces.push({ normal: normal.normalize(), value: i + 1 });
  });

  return faces;
})();

// D20 - Icosahedron
const d20Faces: FaceMapping[] = (() => {
  const faces: FaceMapping[] = [];
  const phi = (1 + Math.sqrt(5)) / 2;

  // Icosahedron has 20 triangular faces
  // Face normals point to centers of triangular faces
  // These are the 20 face center directions
  const t = phi;
  const normals = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(1, -1, 1),
    new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, -1, -1),
    new THREE.Vector3(0, 1/t, t),
    new THREE.Vector3(0, 1/t, -t),
    new THREE.Vector3(0, -1/t, t),
    new THREE.Vector3(0, -1/t, -t),
    new THREE.Vector3(1/t, t, 0),
    new THREE.Vector3(1/t, -t, 0),
    new THREE.Vector3(-1/t, t, 0),
    new THREE.Vector3(-1/t, -t, 0),
    new THREE.Vector3(t, 0, 1/t),
    new THREE.Vector3(t, 0, -1/t),
    new THREE.Vector3(-t, 0, 1/t),
    new THREE.Vector3(-t, 0, -1/t),
  ];

  normals.forEach((normal, i) => {
    faces.push({ normal: normal.normalize(), value: i + 1 });
  });

  return faces;
})();

export const diceFaceMappings: Record<DiceType, FaceMapping[]> = {
  d4: d4Faces,
  d6: d6Faces,
  d8: d8Faces,
  d10: d10Faces,
  d12: d12Faces,
  d20: d20Faces,
};

/**
 * Determine which face of a die is pointing upward based on its rotation
 * @param diceType The type of die
 * @param quaternion The current rotation of the die (from physics)
 * @returns The value on the upward-facing side
 */
export function getUpwardFaceValue(
  diceType: DiceType,
  quaternion: THREE.Quaternion
): number {
  const faces = diceFaceMappings[diceType];
  const worldUp = new THREE.Vector3(0, 1, 0);

  let maxDot = -Infinity;
  let result = 1;

  // For each face, transform its normal to world space and check alignment with up
  for (const face of faces) {
    const worldNormal = face.normal.clone().applyQuaternion(quaternion);
    const dot = worldNormal.dot(worldUp);

    if (dot > maxDot) {
      maxDot = dot;
      result = face.value;
    }
  }

  return result;
}

/**
 * Check if a rigid body has settled (stopped moving)
 * @param linearVelocity Current linear velocity
 * @param angularVelocity Current angular velocity
 * @param threshold Velocity threshold for "stopped"
 */
export function isDiceSettled(
  linearVelocity: { x: number; y: number; z: number },
  angularVelocity: { x: number; y: number; z: number },
  threshold: number = 0.1
): boolean {
  const linearSpeed = Math.sqrt(
    linearVelocity.x ** 2 + linearVelocity.y ** 2 + linearVelocity.z ** 2
  );
  const angularSpeed = Math.sqrt(
    angularVelocity.x ** 2 + angularVelocity.y ** 2 + angularVelocity.z ** 2
  );

  return linearSpeed < threshold && angularSpeed < threshold;
}

export const diceColors: Record<DiceType, string> = {
  d4: '#22c55e',  // Green
  d6: '#eab308',  // Yellow
  d8: '#06b6d4',  // Cyan
  d10: '#f97316', // Orange
  d12: '#a855f7', // Purple
  d20: '#ef4444', // Red
};
