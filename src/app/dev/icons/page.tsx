'use client';

import {
  Skull, Anchor, Crown, Flame, Mountain, TreePine, Castle, Scroll, Ship, Swords,
} from 'lucide-react';
import { MapPin } from '@/components/map/map-pin';
import { DamageBadge, type DamageType } from '@/components/icons/damage-badge';
import { ConditionChip, type ConditionType } from '@/components/icons/condition-chip';
import { SchoolSigil, type SpellSchool } from '@/components/icons/school-sigil';
import { ClassCrest, type DndClass } from '@/components/icons/class-crest';
import { StageMarker, type LifecycleStage } from '@/components/icons/stage-marker';

const DAMAGE_TYPES: DamageType[] = [
  'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison',
  'necrotic', 'radiant', 'force', 'psychic',
  'slashing', 'piercing', 'bludgeoning',
];

const CONDITIONS: ConditionType[] = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened',
  'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified',
  'poisoned', 'prone', 'restrained', 'silenced', 'sleep', 'stunned', 'unconscious',
];

const SCHOOLS: SpellSchool[] = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
];

const CLASSES: DndClass[] = [
  'artificer', 'barbarian', 'bard', 'cleric', 'druid',
  'fighter', 'monk', 'paladin', 'ranger', 'rogue',
  'sorcerer', 'warlock', 'wizard',
];

const STAGES: LifecycleStage[] = ['prep', 'run', 'process', 'schedule', 'recap'];

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--q-font-display, "Cinzel", serif)', fontSize: 18, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'oklch(0.78 0.16 70)' }}>
          {title}
        </h2>
        {subtitle ? (
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--q-text-dim)' }}>{subtitle}</p>
        ) : null}
        <div style={{ marginTop: 8, height: 1, background: 'linear-gradient(90deg, oklch(0.7 0.16 55 / 0.4), transparent)' }} />
      </header>
      {children}
    </section>
  );
}

export default function IconsPreviewPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '48px 56px',
        background: 'var(--q-bg, oklch(0.12 0.005 265))',
        color: 'var(--q-text)',
        fontFamily: 'var(--q-font-body, system-ui)',
      }}
    >
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontFamily: 'var(--q-font-display, "Cinzel", serif)', fontSize: 32, letterSpacing: '0.04em' }}>
          Icon System
        </h1>
        <p style={{ color: 'var(--q-text-dim)', marginTop: 4, fontSize: 14 }}>
          Depth-rich badge components built on the existing D&D SVG library. All scalable, themeable, mask-recolored.
        </p>
      </header>

      {/* MAP PINS */}
      <Section
        title="Map Pins"
        subtitle="Teardrop pin for world/region map. Accepts Lucide or DndIcon. Tones, states, count badge."
      >
        <h3 style={subhead}>Sizes</h3>
        <Row>
          <MapPin icon={Skull} count={4} size={32} label="32px" />
          <MapPin icon={Skull} count={4} size={48} label="48px" />
          <MapPin icon={Skull} count={4} size={56} label="56px" />
          <MapPin icon={Skull} count={4} size={80} label="80px" />
          <MapPin icon={Skull} count={4} size={120} label="120px" />
        </Row>

        <h3 style={subhead}>Lucide icons</h3>
        <Row>
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
        </Row>

        <h3 style={subhead}>DndIcon (existing SVG library)</h3>
        <Row>
          <MapPin icon={{ dnd: 'location/cave' }} label="Cave" />
          <MapPin icon={{ dnd: 'location/dungeon' }} count={2} label="Dungeon" />
          <MapPin icon={{ dnd: 'location/tower' }} label="Tower" />
          <MapPin icon={{ dnd: 'location/ruins' }} count={1} label="Ruins" />
          <MapPin icon={{ dnd: 'location/settlement' }} label="Settlement" />
          <MapPin icon={{ dnd: 'location/forest' }} label="Forest" />
          <MapPin icon={{ dnd: 'game/treasure' }} count={4} label="Treasure" />
          <MapPin icon={{ dnd: 'game/quest' }} label="Quest" />
          <MapPin icon={{ dnd: 'game/tavern' }} label="Tavern" />
          <MapPin icon={{ dnd: 'game/encounter' }} count={3} label="Encounter" tone="crimson" />
        </Row>

        <h3 style={subhead}>Tones &amp; states</h3>
        <Row>
          <MapPin icon={Skull} count={4} tone="amber" label="amber" />
          <MapPin icon={Flame} count={4} tone="crimson" label="crimson" />
          <MapPin icon={Anchor} count={4} tone="azure" label="azure" />
          <MapPin icon={TreePine} count={4} tone="verdant" label="verdant" />
          <MapPin icon={Skull} count={4} state="active" label="Active" />
          <MapPin icon={Skull} count={4} state="visited" label="Visited" />
        </Row>
      </Section>

      {/* DAMAGE BADGES */}
      <Section
        title="Damage Badges"
        subtitle="Round amber-rimmed chip for monster stat blocks, attack rows, and spell descriptions. Pair with a value."
      >
        <h3 style={subhead}>All 13 types</h3>
        <Row>
          {DAMAGE_TYPES.map((d) => (
            <DamageBadge key={d} type={d} label={d} />
          ))}
        </Row>

        <h3 style={subhead}>With values (attack rows)</h3>
        <Row>
          <DamageBadge type="slashing" value="2d6+4" />
          <DamageBadge type="fire" value="8d6" />
          <DamageBadge type="cold" value="3d8" />
          <DamageBadge type="lightning" value="6d6" />
          <DamageBadge type="necrotic" value="4d8+3" />
          <DamageBadge type="radiant" value="2d10" />
        </Row>

        <h3 style={subhead}>Sizes</h3>
        <Row>
          <DamageBadge type="fire" size={24} />
          <DamageBadge type="fire" size={32} />
          <DamageBadge type="fire" size={48} />
          <DamageBadge type="fire" size={64} value="8d6" />
        </Row>
      </Section>

      {/* CONDITION CHIPS */}
      <Section
        title="Condition Chips"
        subtitle="Pill capsule for the initiative tracker and monster cards. Color-coded by category, optional duration."
      >
        <h3 style={subhead}>All 17 conditions</h3>
        <Row>
          {CONDITIONS.map((c) => (
            <ConditionChip key={c} type={c} />
          ))}
        </Row>

        <h3 style={subhead}>With round counts (active effects)</h3>
        <Row>
          <ConditionChip type="poisoned" rounds={3} />
          <ConditionChip type="charmed" rounds={10} />
          <ConditionChip type="frightened" rounds={1} />
          <ConditionChip type="paralyzed" rounds={2} />
          <ConditionChip type="restrained" rounds={4} />
        </Row>

        <h3 style={subhead}>Small (compact tracker rows)</h3>
        <Row>
          <ConditionChip type="poisoned" size="sm" />
          <ConditionChip type="prone" size="sm" />
          <ConditionChip type="grappled" size="sm" />
          <ConditionChip type="stunned" size="sm" rounds={1} />
          <ConditionChip type="invisible" size="sm" />
        </Row>

        <h3 style={subhead}>Icon only (very compact)</h3>
        <Row>
          {CONDITIONS.slice(0, 8).map((c) => (
            <ConditionChip key={c} type={c} size="sm" showLabel={false} />
          ))}
        </Row>

        <h3 style={subhead}>With remove handler</h3>
        <Row>
          <ConditionChip type="poisoned" rounds={3} onRemove={() => {}} />
          <ConditionChip type="charmed" onRemove={() => {}} />
        </Row>
      </Section>

      {/* SCHOOL SIGILS */}
      <Section
        title="School Sigils"
        subtitle="Pure icon, color-coded per school. Designed to overlay on other elements — spell card corners, inline labels, watermarks."
      >
        <h3 style={subhead}>All 8 schools</h3>
        <Row>
          {SCHOOLS.map((s) => (
            <SchoolSigil key={s} school={s} size={32} label={s} />
          ))}
        </Row>

        <h3 style={subhead}>Sizes</h3>
        <Row>
          <SchoolSigil school="evocation" size={16} />
          <SchoolSigil school="evocation" size={20} />
          <SchoolSigil school="evocation" size={24} />
          <SchoolSigil school="evocation" size={32} />
          <SchoolSigil school="evocation" size={48} />
          <SchoolSigil school="evocation" size={64} />
          <SchoolSigil school="evocation" size={96} />
        </Row>

        <h3 style={subhead}>Inline with text</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: "'Cinzel', serif", fontSize: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SchoolSigil school="evocation" size={18} /> Fireball
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SchoolSigil school="abjuration" size={18} /> Shield
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SchoolSigil school="necromancy" size={18} /> Cloudkill
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SchoolSigil school="enchantment" size={18} /> Vicious Mockery
          </span>
        </div>

        <h3 style={subhead}>Overlaid on a spell card</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {(['evocation', 'necromancy', 'illusion'] as const).map((s) => (
            <div
              key={s}
              style={{
                position: 'relative',
                width: 220,
                padding: 16,
                borderRadius: 4,
                background:
                  'linear-gradient(180deg, oklch(0.18 0.012 60 / 0.85), oklch(0.1 0.005 265 / 0.92))',
                border: '1px solid oklch(0.7 0.16 55 / 0.18)',
                boxShadow: '0 8px 24px rgb(0 0 0 / 0.4)',
                color: 'var(--q-text)',
                overflow: 'hidden',
              }}
            >
              {/* Watermark in corner */}
              <div style={{ position: 'absolute', right: -8, bottom: -8, opacity: 0.18 }}>
                <SchoolSigil school={s} size={120} shadow={0} />
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <SchoolSigil school={s} size={20} />
                  <span style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--q-text-dim)' }}>
                    {s}
                  </span>
                </div>
                <h4 style={{ fontFamily: "'Cinzel', serif", fontSize: 18, margin: 0 }}>Sample Spell</h4>
                <p style={{ fontSize: 12, color: 'var(--q-text-dim)', marginTop: 4 }}>
                  Level 3 · V, S, M
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CLASS CRESTS */}
      <Section
        title="Class Crests"
        subtitle="Heraldic shield for character headers and the party strip. Optional level banner."
      >
        <h3 style={subhead}>All 13 classes</h3>
        <Row>
          {CLASSES.map((c) => (
            <ClassCrest key={c} dndClass={c} label={c} />
          ))}
        </Row>

        <h3 style={subhead}>With levels (party strip)</h3>
        <Row>
          <ClassCrest dndClass="fighter" level={5} label="Valen" />
          <ClassCrest dndClass="wizard" level={4} label="Lira" />
          <ClassCrest dndClass="cleric" level={5} label="Doran" />
          <ClassCrest dndClass="rogue" level={4} label="Maeve" />
          <ClassCrest dndClass="barbarian" level={6} label="Gor" />
        </Row>

        <h3 style={subhead}>Sizes</h3>
        <Row>
          <ClassCrest dndClass="paladin" size={40} />
          <ClassCrest dndClass="paladin" size={56} />
          <ClassCrest dndClass="paladin" size={80} level={3} />
          <ClassCrest dndClass="paladin" size={120} level={3} />
        </Row>
      </Section>

      {/* STAGE MARKERS */}
      <Section
        title="Lifecycle Stages"
        subtitle="Coin-style marker for the Prep → Run → Process → Schedule → Recap stepper. Idle / active / complete."
      >
        <h3 style={subhead}>The full stepper (active = Prep)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {STAGES.map((s, i) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
              <StageMarker stage={s} state={i === 0 ? 'active' : 'idle'} />
              {i < STAGES.length - 1 ? (
                <span
                  style={{
                    width: 32,
                    height: 1,
                    background: 'linear-gradient(90deg, oklch(0.7 0.16 55 / 0.5), oklch(0.7 0.16 55 / 0.1))',
                  }}
                />
              ) : null}
            </span>
          ))}
        </div>

        <h3 style={subhead}>Mid-session (active = Run, Prep complete)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {STAGES.map((s, i) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
              <StageMarker
                stage={s}
                state={i === 0 ? 'complete' : i === 1 ? 'active' : 'idle'}
              />
              {i < STAGES.length - 1 ? (
                <span
                  style={{
                    width: 32,
                    height: 1,
                    background:
                      i === 0
                        ? 'linear-gradient(90deg, oklch(0.7 0.16 55 / 0.7), oklch(0.7 0.16 55 / 0.5))'
                        : 'linear-gradient(90deg, oklch(0.7 0.16 55 / 0.3), oklch(0.7 0.16 55 / 0.1))',
                  }}
                />
              ) : null}
            </span>
          ))}
        </div>

        <h3 style={subhead}>States</h3>
        <Row>
          <StageMarker stage="prep" state="idle" />
          <StageMarker stage="prep" state="active" />
          <StageMarker stage="prep" state="complete" />
        </Row>
      </Section>

      <p style={{ marginTop: 64, fontSize: 12, color: 'var(--q-text-faint)', textAlign: 'center' }}>
        All components in <code>src/components/icons/</code> + <code>src/components/map/map-pin.tsx</code>.
      </p>
    </div>
  );
}

const subhead: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--q-text-dim)',
  marginTop: 24,
  marginBottom: 12,
  fontWeight: 600,
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        rowGap: 16,
      }}
    >
      {children}
    </div>
  );
}
