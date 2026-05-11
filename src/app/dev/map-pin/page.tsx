'use client';

import {
  Skull,
  Anchor,
  Swords,
  Crown,
  Flame,
  Mountain,
  TreePine,
  Castle,
  Scroll,
  Ship,
} from 'lucide-react';
import { MapPin } from '@/components/map/map-pin';

export default function MapPinPreviewPage() {
  return (
    <div className="min-h-screen p-12 space-y-12" style={{ background: 'var(--q-bg)' }}>
      <header className="space-y-1">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--q-font-display)' }}>
          Map Pin
        </h1>
        <p className="text-sm" style={{ color: 'var(--q-text-dim)' }}>
          Scalable SVG, depth via gradients + bevel + specular highlight + ground glow.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest" style={{ color: 'var(--q-text-dim)' }}>
          Sizes
        </h2>
        <div className="flex items-end gap-8">
          <MapPin icon={Skull} count={4} size={32} label="32px" />
          <MapPin icon={Skull} count={4} size={48} label="48px" />
          <MapPin icon={Skull} count={4} size={56} label="56px" />
          <MapPin icon={Skull} count={4} size={80} label="80px" />
          <MapPin icon={Skull} count={4} size={120} label="120px" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest" style={{ color: 'var(--q-text-dim)' }}>
          Icons + counts
        </h2>
        <div className="flex items-end gap-6 flex-wrap">
          <MapPin icon={Skull} count={4} label="Combat" />
          <MapPin icon={Anchor} count={1} label="Harbor" />
          <MapPin icon={Swords} count={12} label="Battle" />
          <MapPin icon={Crown} label="Capital" />
          <MapPin icon={Flame} count={99} label="Inferno" />
          <MapPin icon={Mountain} count={130} label="Range" />
          <MapPin icon={TreePine} count={3} label="Forest" />
          <MapPin icon={Castle} label="Keep" />
          <MapPin icon={Scroll} count={7} label="Quest" />
          <MapPin icon={Ship} label="Port" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest" style={{ color: 'var(--q-text-dim)' }}>
          Tones
        </h2>
        <div className="flex items-end gap-6">
          <MapPin icon={Skull} count={4} tone="amber"   label="amber" />
          <MapPin icon={Flame} count={4} tone="crimson" label="crimson" />
          <MapPin icon={Anchor} count={4} tone="azure"  label="azure" />
          <MapPin icon={TreePine} count={4} tone="verdant" label="verdant" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest" style={{ color: 'var(--q-text-dim)' }}>
          States
        </h2>
        <div className="flex items-end gap-6">
          <MapPin icon={Skull} count={4} state="idle"    label="Idle" />
          <MapPin icon={Skull} count={4} state="active"  label="Active" />
          <MapPin icon={Skull} count={4} state="visited" label="Visited" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-widest" style={{ color: 'var(--q-text-dim)' }}>
          On a map background
        </h2>
        <div
          className="relative h-[420px] rounded-md overflow-hidden border"
          style={{
            borderColor: 'var(--q-border)',
            background:
              'radial-gradient(ellipse at 30% 30%, oklch(0.22 0.04 60) 0%, oklch(0.1 0.01 265) 70%)',
          }}
        >
          <div className="absolute" style={{ left: '14%', top: '38%' }}>
            <MapPin icon={Skull} count={4} size={56} label="The Skullspire" />
          </div>
          <div className="absolute" style={{ left: '52%', top: '24%' }}>
            <MapPin icon={Anchor} count={1} size={56} label="Caustic Sinks" />
          </div>
          <div className="absolute" style={{ left: '74%', top: '60%' }}>
            <MapPin icon={Crown} size={56} state="active" label="Capital" />
          </div>
          <div className="absolute" style={{ left: '32%', top: '70%' }}>
            <MapPin icon={Flame} count={2} size={56} tone="crimson" label="Burning Reach" />
          </div>
          <div className="absolute" style={{ left: '60%', top: '78%' }}>
            <MapPin icon={TreePine} size={56} state="visited" label="Old Wood" />
          </div>
        </div>
      </section>
    </div>
  );
}
