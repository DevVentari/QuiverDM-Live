'use client';

import { Flex, Checkbox, Text, Grid } from '@radix-ui/themes';

interface ProficiencySelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  label?: string;
  required?: boolean;
  columns?: number;
}

/**
 * Multi-select checkbox list for proficiencies (skills, weapons, armor, tools)
 */
export function ProficiencySelector({
  value,
  onChange,
  options,
  label,
  required = false,
  columns = 2,
}: ProficiencySelectorProps) {
  const toggleProficiency = (proficiency: string) => {
    if (value.includes(proficiency)) {
      onChange(value.filter((p) => p !== proficiency));
    } else {
      onChange([...value, proficiency]);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {label}
          {required && <span style={{ color: 'var(--red-9)' }}> *</span>}
        </Text>
      )}
      <Grid columns={columns.toString()} gap="2">
        {options.map((option) => (
          <Flex key={option} align="center" gap="2">
            <Checkbox
              checked={value.includes(option)}
              onCheckedChange={() => toggleProficiency(option)}
            />
            <Text size="2">{option}</Text>
          </Flex>
        ))}
      </Grid>
      <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
        {value.length} selected
      </Text>
    </div>
  );
}

// Predefined lists for common proficiency types
export const DND_SKILLS = [
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Religion',
  'Sleight of Hand',
  'Stealth',
  'Survival',
];

export const DND_ARMOR = [
  'Light armor',
  'Medium armor',
  'Heavy armor',
  'Shields',
];

export const DND_WEAPONS = [
  'Simple weapons',
  'Martial weapons',
  'Improvised weapons',
  // Specific weapons
  'Club',
  'Dagger',
  'Greatclub',
  'Handaxe',
  'Javelin',
  'Light hammer',
  'Mace',
  'Quarterstaff',
  'Sickle',
  'Spear',
  'Crossbow, light',
  'Dart',
  'Shortbow',
  'Sling',
  'Battleaxe',
  'Flail',
  'Glaive',
  'Greataxe',
  'Greatsword',
  'Halberd',
  'Lance',
  'Longsword',
  'Maul',
  'Morningstar',
  'Pike',
  'Rapier',
  'Scimitar',
  'Shortsword',
  'Trident',
  'War pick',
  'Warhammer',
  'Whip',
  'Blowgun',
  'Crossbow, hand',
  'Crossbow, heavy',
  'Longbow',
  'Net',
];

export const DND_TOOLS = [
  "Alchemist's supplies",
  "Brewer's supplies",
  "Calligrapher's supplies",
  "Carpenter's tools",
  "Cartographer's tools",
  "Cobbler's tools",
  "Cook's utensils",
  "Glassblower's tools",
  "Jeweler's tools",
  "Leatherworker's tools",
  "Mason's tools",
  "Painter's supplies",
  "Potter's tools",
  "Smith's tools",
  "Tinker's tools",
  "Weaver's tools",
  "Woodcarver's tools",
  'Disguise kit',
  'Forgery kit',
  'Gaming set',
  "Herbalism kit",
  'Musical instrument',
  "Navigator's tools",
  "Poisoner's kit",
  "Thieves' tools",
  'Vehicles (land)',
  'Vehicles (water)',
];

export const DND_LANGUAGES = [
  'Common',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
  'Abyssal',
  'Celestial',
  'Draconic',
  'Deep Speech',
  'Infernal',
  'Primordial',
  'Sylvan',
  'Undercommon',
];
