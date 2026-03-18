import { SpellCard } from '@/components/homebrew/SpellCard';
import { MonsterStatBlock } from '@/components/homebrew/MonsterStatBlock';
import { MagicItemCard } from '@/components/homebrew/MagicItemCard';

const fireball = {
  name: 'Fireball',
  level: 3 as const,
  school: 'evocation' as const,
  castingTime: '1 Action',
  range: '150 ft',
  duration: 'Instantaneous',
  concentration: false,
  components: { verbal: true, somatic: true, material: true, materialDesc: 'a tiny ball of bat guano' },
  description: 'A bright streak flashes from your finger. Each creature in a **20-foot radius** must make a DEX save or take **8d6 fire damage**.',
  higherLevels: '+1d6 per slot level above 3rd.',
  save: 'DEX · Half',
};

const ogre = {
  name: 'Ogre',
  size: 'Large' as const,
  type: 'Giant',
  alignment: 'Chaotic Evil',
  cr: 2,
  xp: 450,
  ac: 11,
  acNote: 'hide armour',
  hp: 59,
  hpDice: '7d10+21',
  speed: '40 ft',
  abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
  senses: 'Darkvision 60 ft',
  passivePerception: 8,
  languages: 'Common, Giant',
  traits: [{ name: 'Aggressive', description: 'As a bonus action, the ogre can move up to its speed toward a hostile creature.' }],
  actions: [
    { name: 'Greatclub', type: 'Melee Weapon Attack', toHit: 6, reach: '10 ft', damage: '2d8+4 bludgeoning', description: '+6 to hit, reach 10 ft, one target.' },
  ],
};

const vorpalSword = {
  name: 'Vorpal Sword',
  rarity: 'legendary' as const,
  type: 'Weapon · Sword',
  attunement: true,
  description: 'You gain a **+3 bonus** to attack and damage rolls. On a roll of **20**, you cut off one of the target\'s heads.',
  lore: '"One, two! One, two! And through and through, the vorpal blade went snicker-snack."',
};

export default function CardFixturePage() {
  return (
    <div className="dark min-h-screen p-6 space-y-8" style={{ background: 'hsl(240 10% 6%)' }}>
      <h1 className="text-lg font-semibold text-white">Card Component Fixtures</h1>
      <section data-testid="spell-cards">
        <h2 className="text-sm text-muted-foreground mb-3">Spell Cards</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <SpellCard spell={fireball} variant="collapsed" />
          <SpellCard spell={fireball} variant="expanded" />
        </div>
      </section>
      <section data-testid="monster-blocks">
        <h2 className="text-sm text-muted-foreground mb-3">Monster Stat Blocks</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <MonsterStatBlock monster={ogre} mode="drawer" />
          <MonsterStatBlock monster={ogre} mode="full" />
        </div>
      </section>
      <section data-testid="magic-item-cards">
        <h2 className="text-sm text-muted-foreground mb-3">Magic Item Cards</h2>
        <div className="max-w-xs">
          <MagicItemCard item={vorpalSword} />
        </div>
      </section>
    </div>
  );
}
