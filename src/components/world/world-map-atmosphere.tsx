'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WorldMapAtmosphereProps {
  intensity: number;
}

export function WorldMapAtmosphere({ intensity }: WorldMapAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || intensity <= 0) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = 1;

    const amberLight = new THREE.PointLight(0xc9872a, intensity * 2.5);
    amberLight.position.set(-2, -1, 0.5);
    scene.add(amberLight);

    const purpleLight = new THREE.PointLight(0x6b21a8, intensity * 1.2);
    purpleLight.position.set(2, 1.5, 0.5);
    scene.add(purpleLight);

    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uIntensity;
        void main() {
          float amber = 1.0 - smoothstep(0.0, 0.85, distance(vUv, vec2(0.08, 0.14)));
          float violet = 1.0 - smoothstep(0.0, 0.9, distance(vUv, vec2(0.92, 0.86)));
          vec3 color = vec3(0.95, 0.42, 0.08) * amber + vec3(0.35, 0.12, 0.62) * violet;
          float alpha = (amber * 0.32 + violet * 0.18) * uIntensity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), glowMaterial);
    glow.position.z = -0.04;
    scene.add(glow);

    const emberCount = Math.floor(intensity * 40);
    const emberPositions = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i += 1) {
      emberPositions[i * 3] = Math.random() * 4 - 2;
      emberPositions[i * 3 + 1] = Math.random() * 2 - 1;
      emberPositions[i * 3 + 2] = Math.random() * 0.05;
    }
    const emberGeometry = new THREE.BufferGeometry();
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    const emberMaterial = new THREE.PointsMaterial({
      color: 0xff6010,
      size: 0.008,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const embers = new THREE.Points(emberGeometry, emberMaterial);
    scene.add(embers);

    const fogMaterial = new THREE.MeshBasicMaterial({
      color: 0x0d0b18,
      transparent: true,
      opacity: intensity * 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const topFog = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.4), fogMaterial.clone());
    topFog.position.y = 0.9;
    topFog.position.z = -0.02;
    const bottomFog = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.4), fogMaterial);
    bottomFog.position.y = -0.9;
    bottomFog.position.z = -0.02;
    scene.add(topFog, bottomFog);

    const grainMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd8a0,
      transparent: true,
      opacity: 0.02 * intensity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const grain = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), grainMaterial);
    grain.position.z = -0.01;
    scene.add(grain);

    const vignetteMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uIntensity;
        void main() {
          vec2 uv = vUv - 0.5;
          float d = dot(uv, uv) * 2.0;
          float v = smoothstep(0.2, 1.0, d) * uIntensity * 0.75;
          gl_FragColor = vec4(0.04, 0.03, 0.07, v);
        }
      `,
      depthWrite: false,
      transparent: true,
    });
    const vignette = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), vignetteMaterial);
    scene.add(vignette);

    const resize = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);

    const clock = new THREE.Clock();
    let animationFrame = 0;

    const animate = () => {
      const delta = clock.getDelta();
      const time = clock.elapsedTime;
      camera.position.x = Math.sin(time * 0.18) * 0.06 * intensity;
      grainMaterial.opacity = Math.sin(time * 24) * 0.02 * intensity + 0.02 * intensity;

      const positions = emberGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < emberCount; i += 1) {
        const nextY = positions.getY(i) + 0.0003 * delta * 60;
        positions.setY(i, nextY > 1 ? -1 : nextY);
      }
      positions.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      emberGeometry.dispose();
      emberMaterial.dispose();
      glow.geometry.dispose();
      glowMaterial.dispose();
      topFog.geometry.dispose();
      bottomFog.geometry.dispose();
      topFog.material.dispose();
      bottomFog.material.dispose();
      grain.geometry.dispose();
      grainMaterial.dispose();
      vignette.geometry.dispose();
      vignetteMaterial.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [intensity]);

  if (intensity === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
}
