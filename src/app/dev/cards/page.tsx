'use client';

import { useState } from 'react';
import { SpellCard, type SpellCardData } from '@/components/homebrew/SpellCard';
import { MonsterStatBlock } from '@/components/homebrew/MonsterStatBlock';
import { MagicItemCard } from '@/components/homebrew/MagicItemCard';
import { CharacterCard, type CharacterCardData } from '@/components/character/CharacterCard';
import { CharacterQuickViewSheet } from '@/components/character/CharacterQuickViewSheet';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fireball = {
  name: 'Fireball', level: 3 as const, school: 'evocation' as const,
  castingTime: '1 Action', range: '150 ft', duration: 'Instantaneous', concentration: false,
  components: { verbal: true, somatic: true, material: true, materialDesc: 'a tiny ball of bat guano' },
  description: 'A bright streak flashes from your finger. Each creature in a **20-foot radius** must make a DEX save or take **8d6 fire damage**.',
  higherLevels: '+1d6 per slot level above 3rd.', save: 'DEX · Half', classes: ['Wizard', 'Sorcerer'],
};
const holdPerson = {
  name: 'Hold Person', level: 2 as const, school: 'enchantment' as const,
  castingTime: '1 Action', range: '60 ft', duration: 'Concentration, up to 1 minute', concentration: true,
  components: { verbal: true, somatic: true, material: true, materialDesc: 'a small, straight piece of iron' },
  description: 'Choose a humanoid. The target must succeed on a **WIS saving throw** or be **paralyzed** for the duration.',
  save: 'WIS · Negate', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
};
const mageArmor = {
  name: 'Mage Armor', level: 1 as const, school: 'abjuration' as const,
  castingTime: '1 Action', range: 'Touch', duration: '8 hours', concentration: false,
  components: { verbal: true, somatic: true, material: true, materialDesc: 'a piece of cured leather' },
  description: "You touch a willing creature who isn't wearing armor. Until the spell ends, the target's base AC becomes **13 + its Dexterity modifier**.",
  classes: ['Sorcerer', 'Wizard'],
};
const eldritchBlast = {
  name: 'Eldritch Blast', level: 'cantrip' as const, school: 'evocation' as const,
  castingTime: '1 Action', range: '120 ft', duration: 'Instantaneous', concentration: false,
  components: { verbal: true, somatic: true, material: false },
  description: 'A beam of crackling energy streaks toward a creature. Make a ranged spell attack against the target. On a hit, the target takes **1d10 force damage**.',
  classes: ['Warlock'],
};

const ogre = {
  name: 'Ogre', size: 'Large' as const, type: 'Giant', alignment: 'Chaotic Evil', cr: 2, xp: 450,
  ac: 11, acNote: 'hide armour', hp: 59, hpDice: '7d10+21', speed: '40 ft',
  abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
  senses: 'Darkvision 60 ft', passivePerception: 8, languages: 'Common, Giant',
  traits: [{ name: 'Aggressive', description: 'As a bonus action, the ogre can move up to its speed toward a hostile creature.' }],
  actions: [{ name: 'Greatclub', type: 'Melee Weapon Attack', toHit: 6, reach: '10 ft', damage: '2d8+4 bludgeoning', description: '+6 to hit, reach 10 ft, one target.' }],
};
const lich = {
  name: 'Lich', size: 'Medium' as const, type: 'Undead', alignment: 'Neutral Evil', cr: 21, xp: 33000,
  ac: 17, acNote: 'natural armour', hp: 135, hpDice: '18d8+54', speed: '30 ft',
  abilities: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 },
  savingThrows: { con: 10, int: 12, wis: 9 },
  skills: { 'Arcana': 18, 'History': 12, 'Insight': 9, 'Perception': 9 },
  damageResistances: ['cold', 'lightning', 'necrotic'],
  damageImmunities: ['poison', 'bludgeoning, piercing, and slashing from nonmagical weapons'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: 'Truesight 120 ft', passivePerception: 19, languages: 'Common plus up to five other languages',
  traits: [
    { name: 'Legendary Resistance (3/Day)', description: 'If the lich fails a saving throw, it can choose to succeed instead.' },
    { name: 'Turn Resistance', description: 'The lich has advantage on saving throws against any effect that turns undead.' },
  ],
  actions: [{ name: 'Paralyzing Touch', type: 'Melee Spell Attack', toHit: 12, reach: '5 ft', damage: '3d6 cold', description: 'The target must succeed on a DC 18 CON save or be paralyzed until the end of its next turn.' }],
  legendaryActions: { count: 3, actions: [
    { name: 'Cantrip', description: 'The lich casts a cantrip.' },
    { name: 'Paralyzing Touch (Costs 2 Actions)', description: 'The lich uses its Paralyzing Touch.' },
    { name: 'Frightening Gaze (Costs 2 Actions)', description: 'The lich fixes its gaze on one creature within 10 feet. DC 18 WIS or frightened 1 minute.' },
  ]},
};

const vorpalSword    = { name: 'Vorpal Sword',      rarity: 'legendary' as const, type: 'Weapon · Sword', attunement: true, description: 'You gain a **+3 bonus** to attack and damage rolls. On a roll of **20**, you cut off one of the target\'s heads.', lore: '"One, two! And through and through, the vorpal blade went snicker-snack."' };
const ringOfProtection = { name: 'Ring of Protection', rarity: 'rare' as const,     type: 'Ring',          attunement: true, description: 'You gain a **+1 bonus to AC** and saving throws while wearing this ring.' };
const staffOfTheMagi   = { name: 'Staff of the Magi',  rarity: 'artifact' as const,  type: 'Weapon · Staff', attunement: true, attunementNote: 'by a sorcerer, warlock, or wizard', description: 'While holding it, you gain a **+2 bonus to spell attack rolls**.', charges: { max: 50, current: 38, reset: 'dawn (4d6+2)' } };
const potionOfHealing  = { name: 'Potion of Healing',  rarity: 'common' as const,    type: 'Potion',        attunement: false, description: 'You regain **2d4+2 hit points** when you drink this potion.' };

const arannis: CharacterCardData = { id: 'f1', name: 'Captain Arannis Vaelor', race: 'Elf', class: 'Wizard', subclass: 'Divination', level: 8, portraitUrl: 'https://picsum.photos/seed/arannis/400/300', dndBeyondId: '12345678', armorClass: 15, speed: 30, proficiencyBonus: 3, hitPoints: { current: 38, max: 52, temp: 0 }, abilityScores: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 }, campaignCharacters: [{ campaign: { id: 'c1', name: 'Curse of Strahd', slug: 'curse-of-strahd' } }] };
const bruenor: CharacterCardData = { id: 'f2', name: 'Bruenor Battlehammer',   race: 'Dwarf', class: 'Fighter', subclass: 'Battle Master', level: 5, portraitUrl: null, dndBeyondId: null, armorClass: 18, speed: 25, proficiencyBonus: 3, hitPoints: { current: 12, max: 52 }, abilityScores: { str: 18, dex: 10, con: 16, int: 9, wis: 11, cha: 8 }, campaignCharacters: [{ campaign: { id: 'c1', name: 'Icewind Dale', slug: 'icewind-dale' } }] };
const lyra:    CharacterCardData = { id: 'f3', name: 'Lyra Swiftwind',          race: 'Half-Elf', class: 'Rogue', subclass: null, level: 3, portraitUrl: null, dndBeyondId: null, armorClass: 14, speed: 30, proficiencyBonus: 2, hitPoints: { current: 0, max: 0 }, abilityScores: null, campaignCharacters: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="section-rule" />
      <h2 className="label-overline">{children}</h2>
    </div>
  );
}

function ToggleSpell({ spell }: { spell: SpellCardData }) {
  const [expanded, setExpanded] = useState(false);
  return <SpellCard spell={spell} variant={expanded ? 'expanded' : 'collapsed'} onToggle={() => setExpanded(v => !v)} />;
}

function CharacterCardFixtures() {
  const [sheetChar, setSheetChar] = useState<CharacterCardData | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[arannis, bruenor, lyra].map(c => (
          <CharacterCard key={c.id} character={c} onQuickView={() => setSheetChar(c)} />
        ))}
      </div>
      <CharacterQuickViewSheet character={sheetChar} open={sheetChar !== null} onOpenChange={v => { if (!v) setSheetChar(null); }} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CardFixturePage() {
  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 900, margin: '0 auto' }}>
      <div className="mb-8">
        <div className="label-overline mb-2">Dev</div>
        <h1 className="text-fluid-2xl" style={{ fontFamily: 'var(--q-font-display)', color: 'var(--q-text)' }}>
          Cards
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--q-text-dim)' }}>
          Component fixtures — CharacterCard · SpellCard · MonsterStatBlock · MagicItemCard
        </p>
      </div>

      <SectionHeading>Character Card</SectionHeading>
      <div className="mb-10">
        <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
          Portrait hero · Initials fallback · No data (empty HP) — hover for quick-view
        </p>
        <CharacterCardFixtures />
      </div>

      <SectionHeading>Spell Card — collapsed (click to expand)</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-6">
        <ToggleSpell spell={eldritchBlast} />
        <ToggleSpell spell={holdPerson} />
        <ToggleSpell spell={fireball} />
        <ToggleSpell spell={mageArmor} />
      </div>

      <SectionHeading>Spell Card — expanded</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-10">
        <SpellCard spell={fireball} variant="expanded" />
        <SpellCard spell={holdPerson} variant="expanded" />
      </div>

      <SectionHeading>Monster Stat Block — drawer</SectionHeading>
      <div className="grid grid-cols-2 gap-4 max-w-xl mb-6">
        <MonsterStatBlock monster={ogre} mode="drawer" />
        <MonsterStatBlock monster={lich} mode="drawer" />
      </div>

      <SectionHeading>Monster Stat Block — full</SectionHeading>
      <div className="grid grid-cols-2 gap-4 max-w-2xl mb-10">
        <MonsterStatBlock monster={ogre} mode="full" />
        <MonsterStatBlock monster={lich} mode="full" />
      </div>

      <SectionHeading>Magic Item Card — all rarities</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-10">
        <MagicItemCard item={potionOfHealing} />
        <MagicItemCard item={ringOfProtection} />
        <MagicItemCard item={vorpalSword} />
        <MagicItemCard item={staffOfTheMagi} />
      </div>
    </div>
  );
}
