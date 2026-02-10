'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Heading,
  Text,
  Card,
  Flex,
  Button,
  TextField,
  TextArea,
  Select,
  Box,
  Grid,
  Separator,
  Switch
} from '@radix-ui/themes';
import {
  ArrowLeft,
  Save,
  User,
  Sword,
  Shield,
  Heart,
  Zap,
  Brain,
  Eye,
  Smile,
  Footprints
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// D&D 5e Data
const RACES = [
  'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling',
  'Half-Orc', 'Human', 'Tiefling', 'Aasimar', 'Goliath', 'Tabaxi',
  'Kenku', 'Firbolg', 'Triton', 'Lizardfolk', 'Goblin', 'Hobgoblin',
  'Bugbear', 'Orc', 'Yuan-ti Pureblood', 'Tortle', 'Warforged',
  'Changeling', 'Kalashtar', 'Shifter', 'Genasi', 'Aarakocra'
];

const CLASSES = [
  { name: 'Barbarian', hitDie: 12, subclasses: ['Berserker', 'Totem Warrior', 'Ancestral Guardian', 'Storm Herald', 'Zealot', 'Beast', 'Wild Magic'] },
  { name: 'Bard', hitDie: 8, subclasses: ['Lore', 'Valor', 'Glamour', 'Swords', 'Whispers', 'Creation', 'Eloquence'] },
  { name: 'Cleric', hitDie: 8, subclasses: ['Knowledge', 'Life', 'Light', 'Nature', 'Tempest', 'Trickery', 'War', 'Death', 'Arcana', 'Forge', 'Grave', 'Order', 'Peace', 'Twilight'] },
  { name: 'Druid', hitDie: 8, subclasses: ['Land', 'Moon', 'Dreams', 'Shepherd', 'Spores', 'Stars', 'Wildfire'] },
  { name: 'Fighter', hitDie: 10, subclasses: ['Champion', 'Battle Master', 'Eldritch Knight', 'Arcane Archer', 'Cavalier', 'Samurai', 'Psi Warrior', 'Rune Knight', 'Echo Knight'] },
  { name: 'Monk', hitDie: 8, subclasses: ['Open Hand', 'Shadow', 'Four Elements', 'Drunken Master', 'Kensei', 'Sun Soul', 'Long Death', 'Mercy', 'Astral Self'] },
  { name: 'Paladin', hitDie: 10, subclasses: ['Devotion', 'Ancients', 'Vengeance', 'Conquest', 'Redemption', 'Glory', 'Watchers', 'Oathbreaker'] },
  { name: 'Ranger', hitDie: 10, subclasses: ['Hunter', 'Beast Master', 'Gloom Stalker', 'Horizon Walker', 'Monster Slayer', 'Fey Wanderer', 'Swarmkeeper', 'Drakewarden'] },
  { name: 'Rogue', hitDie: 8, subclasses: ['Thief', 'Assassin', 'Arcane Trickster', 'Mastermind', 'Swashbuckler', 'Inquisitive', 'Scout', 'Phantom', 'Soulknife'] },
  { name: 'Sorcerer', hitDie: 6, subclasses: ['Draconic', 'Wild Magic', 'Divine Soul', 'Shadow', 'Storm', 'Aberrant Mind', 'Clockwork Soul'] },
  { name: 'Warlock', hitDie: 8, subclasses: ['Archfey', 'Fiend', 'Great Old One', 'Celestial', 'Hexblade', 'Fathomless', 'Genie', 'Undead'] },
  { name: 'Wizard', hitDie: 6, subclasses: ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Bladesinging', 'War Magic', 'Chronurgy', 'Graviturgy', 'Order of Scribes'] },
  { name: 'Artificer', hitDie: 8, subclasses: ['Alchemist', 'Armorer', 'Artillerist', 'Battle Smith'] },
  { name: 'Blood Hunter', hitDie: 10, subclasses: ['Ghostslayer', 'Lycan', 'Mutant', 'Profane Soul'] },
];

const BACKGROUNDS = [
  'Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero',
  'Guild Artisan', 'Hermit', 'Noble', 'Outlander', 'Sage',
  'Sailor', 'Soldier', 'Urchin', 'Haunted One', 'Knight',
  'Pirate', 'Far Traveler', 'Urban Bounty Hunter', 'Investigator'
];

interface FormData {
  name: string;
  race: string;
  class: string;
  subclass: string;
  level: number;
  background: string;
  isPortable: boolean;
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  hitPoints: {
    current: number;
    max: number;
  };
  armorClass: number | undefined;
  speed: number;
  backstory: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

const defaultFormData: FormData = {
  name: '',
  race: '',
  class: '',
  subclass: '',
  level: 1,
  background: '',
  isPortable: true,
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  hitPoints: { current: 10, max: 10 },
  armorClass: 10,
  speed: 30,
  backstory: '',
  personalityTraits: '',
  ideals: '',
  bonds: '',
  flaws: '',
};

export default function NewCharacterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.characters.create.useMutation();

  const selectedClass = CLASSES.find((c) => c.name === formData.class);

  const handleAbilityChange = (ability: keyof FormData['abilityScores'], value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      abilityScores: {
        ...prev.abilityScores,
        [ability]: Math.min(30, Math.max(1, numValue)),
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Character name is required';
    if (!formData.race) newErrors.race = 'Race is required';
    if (!formData.class) newErrors.class = 'Class is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: formData.name.trim(),
        race: formData.race || undefined,
        class: formData.class || undefined,
        subclass: formData.subclass || undefined,
        level: formData.level,
        background: formData.background || undefined,
        isPortable: formData.isPortable,
        abilityScores: formData.abilityScores,
        hitPoints: formData.hitPoints,
        armorClass: formData.armorClass,
        speed: formData.speed,
        backstory: formData.backstory || undefined,
        personalityTraits: formData.personalityTraits || undefined,
        ideals: formData.ideals || undefined,
        bonds: formData.bonds || undefined,
        flaws: formData.flaws || undefined,
      });

      router.push(`/characters/${result.id}`);
    } catch (error) {
      console.error('Failed to create character:', error);
      setErrors({ submit: 'Failed to create character. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
      <Container size="3" className="py-8">
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="6">
            {/* Header */}
            <Flex justify="between" align="center">
              <div>
                <Link href="/characters">
                  <Button variant="ghost" className="text-gray-400 hover:text-white mb-2" type="button">
                    <ArrowLeft size={20} />
                    Back to Characters
                  </Button>
                </Link>
                <Heading size="8" className="text-white">
                  Create New Character
                </Heading>
              </div>
              <Button
                size="3"
                type="submit"
                disabled={createMutation.isPending}
                style={{ backgroundColor: '#8B5CF6' }}
              >
                <Save size={20} />
                {createMutation.isPending ? 'Creating...' : 'Create Character'}
              </Button>
            </Flex>

            {errors.submit && (
              <Card className="bg-red-900/30 border border-red-700">
                <Text className="text-red-400 p-4">{errors.submit}</Text>
              </Card>
            )}

            {/* Basic Info Section */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="5" p="6">
                <Heading size="5" className="text-white">Basic Information</Heading>
                <Separator className="bg-gray-700" />

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                  {/* Name */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Character Name *
                    </Text>
                    <TextField.Root
                      size="3"
                      placeholder="Enter character name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    {errors.name && <Text size="1" color="red" className="mt-1">{errors.name}</Text>}
                  </Box>

                  {/* Level */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Level
                    </Text>
                    <TextField.Root
                      size="3"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    />
                  </Box>

                  {/* Race */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Race *
                    </Text>
                    <Select.Root
                      size="3"
                      value={formData.race}
                      onValueChange={(value) => setFormData({ ...formData, race: value })}
                    >
                      <Select.Trigger placeholder="Select race" style={{ width: '100%' }} />
                      <Select.Content>
                        {RACES.map((race) => (
                          <Select.Item key={race} value={race}>
                            {race}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                    {errors.race && <Text size="1" color="red" className="mt-1">{errors.race}</Text>}
                  </Box>

                  {/* Class */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Class *
                    </Text>
                    <Select.Root
                      size="3"
                      value={formData.class}
                      onValueChange={(value) => setFormData({ ...formData, class: value, subclass: '' })}
                    >
                      <Select.Trigger placeholder="Select class" style={{ width: '100%' }} />
                      <Select.Content>
                        {CLASSES.map((cls) => (
                          <Select.Item key={cls.name} value={cls.name}>
                            {cls.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                    {errors.class && <Text size="1" color="red" className="mt-1">{errors.class}</Text>}
                  </Box>

                  {/* Subclass */}
                  {selectedClass && (
                    <Box>
                      <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                        Subclass
                      </Text>
                      <Select.Root
                        size="3"
                        value={formData.subclass}
                        onValueChange={(value) => setFormData({ ...formData, subclass: value })}
                      >
                        <Select.Trigger placeholder="Select subclass" style={{ width: '100%' }} />
                        <Select.Content>
                          {selectedClass.subclasses.map((sub) => (
                            <Select.Item key={sub} value={sub}>
                              {sub}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Box>
                  )}

                  {/* Background */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Background
                    </Text>
                    <Select.Root
                      size="3"
                      value={formData.background}
                      onValueChange={(value) => setFormData({ ...formData, background: value })}
                    >
                      <Select.Trigger placeholder="Select background" style={{ width: '100%' }} />
                      <Select.Content>
                        {BACKGROUNDS.map((bg) => (
                          <Select.Item key={bg} value={bg}>
                            {bg}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Box>
                </Grid>

                {/* Portable Toggle */}
                <Flex align="center" gap="3">
                  <Switch
                    checked={formData.isPortable}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPortable: checked })}
                  />
                  <Box>
                    <Text size="2" weight="bold" className="text-gray-300 block">
                      Portable Character
                    </Text>
                    <Text size="1" className="text-gray-500">
                      Allow this character to be used in multiple campaigns
                    </Text>
                  </Box>
                </Flex>
              </Flex>
            </Card>

            {/* Ability Scores Section */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="5" p="6">
                <Heading size="5" className="text-white">Ability Scores</Heading>
                <Separator className="bg-gray-700" />

                <Grid columns={{ initial: '2', sm: '3', md: '6' }} gap="4">
                  {[
                    { key: 'str', label: 'Strength', icon: <Sword size={20} className="text-red-400" /> },
                    { key: 'dex', label: 'Dexterity', icon: <Zap size={20} className="text-yellow-400" /> },
                    { key: 'con', label: 'Constitution', icon: <Heart size={20} className="text-pink-400" /> },
                    { key: 'int', label: 'Intelligence', icon: <Brain size={20} className="text-blue-400" /> },
                    { key: 'wis', label: 'Wisdom', icon: <Eye size={20} className="text-purple-400" /> },
                    { key: 'cha', label: 'Charisma', icon: <Smile size={20} className="text-orange-400" /> },
                  ].map(({ key, label, icon }) => (
                    <Card key={key} className="bg-gray-900/50 border border-gray-700">
                      <Flex direction="column" align="center" gap="2" p="4">
                        {icon}
                        <Text size="1" className="text-gray-400 uppercase">{key}</Text>
                        <TextField.Root
                          size="2"
                          type="number"
                          min={1}
                          max={30}
                          value={formData.abilityScores[key as keyof typeof formData.abilityScores]}
                          onChange={(e) => handleAbilityChange(key as keyof FormData['abilityScores'], e.target.value)}
                          style={{ width: '60px', textAlign: 'center' }}
                        />
                      </Flex>
                    </Card>
                  ))}
                </Grid>
              </Flex>
            </Card>

            {/* Combat Stats Section */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="5" p="6">
                <Heading size="5" className="text-white">Combat Stats</Heading>
                <Separator className="bg-gray-700" />

                <Grid columns={{ initial: '2', md: '4' }} gap="4">
                  <Box>
                    <Flex align="center" gap="2" mb="2">
                      <Heart size={16} className="text-red-400" />
                      <Text size="2" weight="bold" className="text-gray-300">Max HP</Text>
                    </Flex>
                    <TextField.Root
                      size="3"
                      type="number"
                      min={1}
                      value={formData.hitPoints.max}
                      onChange={(e) => {
                        const max = parseInt(e.target.value) || 1;
                        setFormData({
                          ...formData,
                          hitPoints: { ...formData.hitPoints, max, current: max },
                        });
                      }}
                    />
                  </Box>

                  <Box>
                    <Flex align="center" gap="2" mb="2">
                      <Shield size={16} className="text-blue-400" />
                      <Text size="2" weight="bold" className="text-gray-300">Armor Class</Text>
                    </Flex>
                    <TextField.Root
                      size="3"
                      type="number"
                      min={1}
                      max={30}
                      value={formData.armorClass ?? ''}
                      onChange={(e) => setFormData({ ...formData, armorClass: parseInt(e.target.value) || undefined })}
                    />
                  </Box>

                  <Box>
                    <Flex align="center" gap="2" mb="2">
                      <Footprints size={16} className="text-green-400" />
                      <Text size="2" weight="bold" className="text-gray-300">Speed (ft)</Text>
                    </Flex>
                    <TextField.Root
                      size="3"
                      type="number"
                      min={0}
                      value={formData.speed}
                      onChange={(e) => setFormData({ ...formData, speed: parseInt(e.target.value) || 30 })}
                    />
                  </Box>
                </Grid>
              </Flex>
            </Card>

            {/* Backstory & Personality Section */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="5" p="6">
                <Heading size="5" className="text-white">Backstory & Personality</Heading>
                <Separator className="bg-gray-700" />

                <Box>
                  <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                    Backstory
                  </Text>
                  <TextArea
                    size="3"
                    placeholder="Tell the story of your character's past..."
                    rows={6}
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                  />
                </Box>

                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Personality Traits
                    </Text>
                    <TextArea
                      size="2"
                      placeholder="How does your character behave?"
                      rows={3}
                      value={formData.personalityTraits}
                      onChange={(e) => setFormData({ ...formData, personalityTraits: e.target.value })}
                    />
                  </Box>

                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Ideals
                    </Text>
                    <TextArea
                      size="2"
                      placeholder="What principles does your character believe in?"
                      rows={3}
                      value={formData.ideals}
                      onChange={(e) => setFormData({ ...formData, ideals: e.target.value })}
                    />
                  </Box>

                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Bonds
                    </Text>
                    <TextArea
                      size="2"
                      placeholder="What connections drive your character?"
                      rows={3}
                      value={formData.bonds}
                      onChange={(e) => setFormData({ ...formData, bonds: e.target.value })}
                    />
                  </Box>

                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Flaws
                    </Text>
                    <TextArea
                      size="2"
                      placeholder="What weaknesses does your character have?"
                      rows={3}
                      value={formData.flaws}
                      onChange={(e) => setFormData({ ...formData, flaws: e.target.value })}
                    />
                  </Box>
                </Grid>
              </Flex>
            </Card>

            {/* Submit Button (Mobile) */}
            <Button
              size="4"
              type="submit"
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#8B5CF6' }}
              className="md:hidden"
            >
              <Save size={20} />
              {createMutation.isPending ? 'Creating...' : 'Create Character'}
            </Button>
          </Flex>
        </form>
      </Container>
    </div>
  );
}
