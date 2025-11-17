'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Container,
  Heading,
  Button,
  Flex,
  TextField,
  Select,
  Switch,
  Text,
  Grid,
  Box,
  TextArea,
} from '@radix-ui/themes';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { trpc } from '@/lib/trpc';
import {
  RichTextEditor,
  AbilityScoreInput,
  TagSelector,
  FormSection,
  ProficiencySelector,
  DND_SKILLS,
} from '@/components/homebrew/forms';

interface Action {
  name: string;
  description: string;
  attackType?: string;
  attackBonus?: string;
  reach?: string;
  range?: string;
  damageCount?: string;
  diceSize?: string;
  damageModifier?: string;
  damageType?: string;
}

interface CreatureFormData {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  acType: string;
  hpAverage: string;
  hpDiceCount: string;
  hpDiceSize: string;
  hpModifier: string;
  speedWalk: string;
  speedFly: string;
  speedSwim: string;
  speedBurrow: string;
  speedClimb: string;
  hover: boolean;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  savingThrows: string[];
  skills: Record<string, number>;
  damageVulnerabilities: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  darkvision: string;
  blindsight: string;
  truesight: string;
  tremorsense: string;
  passivePerception: string;
  languages: string;
  cr: string;
  proficiencyBonus: string;
  traits: Array<{ name: string; description: string }>;
  actions: Action[];
  reactions: Array<{ name: string; description: string }>;
  hasLegendaryActions: boolean;
  legendaryActionsPerRound: string;
  legendaryActionDescription: string;
  legendaryActions: Array<{ name: string; cost: number; description: string }>;
  description: string;
  lore: string;
  tags: string[];
}

export default function CreateCreaturePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreatureFormData>({
    name: '',
    size: 'Medium',
    type: 'humanoid',
    alignment: 'unaligned',
    ac: '10',
    acType: '',
    hpAverage: '10',
    hpDiceCount: '2',
    hpDiceSize: '8',
    hpModifier: '0',
    speedWalk: '30',
    speedFly: '',
    speedSwim: '',
    speedBurrow: '',
    speedClimb: '',
    hover: false,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: {},
    damageVulnerabilities: '',
    damageResistances: '',
    damageImmunities: '',
    conditionImmunities: '',
    darkvision: '',
    blindsight: '',
    truesight: '',
    tremorsense: '',
    passivePerception: '10',
    languages: '',
    cr: '1',
    proficiencyBonus: '2',
    traits: [],
    actions: [{ name: '', description: '' }],
    reactions: [],
    hasLegendaryActions: false,
    legendaryActionsPerRound: '3',
    legendaryActionDescription: '',
    legendaryActions: [],
    description: '',
    lore: '',
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof CreatureFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = (field: 'traits' | 'actions' | 'reactions' | 'legendaryActions') => {
    const newItem = field === 'legendaryActions'
      ? { name: '', cost: 1, description: '' }
      : { name: '', description: '' };
    updateField(field, [...formData[field], newItem]);
  };

  const updateItem = (field: 'traits' | 'actions' | 'reactions' | 'legendaryActions', index: number, key: string, value: any) => {
    const items = [...formData[field]];
    (items[index] as any)[key] = value;
    updateField(field, items);
  };

  const removeItem = (field: 'traits' | 'actions' | 'reactions' | 'legendaryActions', index: number) => {
    const items = [...formData[field]];
    items.splice(index, 1);
    updateField(field, items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const creatureData: any = {
        size: formData.size,
        type: formData.type,
        alignment: formData.alignment,
        ac: parseInt(formData.ac),
        acType: formData.acType || undefined,
        hitPoints: {
          average: parseInt(formData.hpAverage),
          diceCount: parseInt(formData.hpDiceCount),
          diceSize: parseInt(formData.hpDiceSize),
          modifier: parseInt(formData.hpModifier),
        },
        speed: {
          walk: parseInt(formData.speedWalk) || undefined,
          fly: parseInt(formData.speedFly) || undefined,
          swim: parseInt(formData.speedSwim) || undefined,
          burrow: parseInt(formData.speedBurrow) || undefined,
          climb: parseInt(formData.speedClimb) || undefined,
          hover: formData.hover,
        },
        abilities: formData.abilities,
        challengeRating: formData.cr,
        proficiencyBonus: parseInt(formData.proficiencyBonus),
        description: formData.description,
        lore: formData.lore || undefined,
      };

      // Optional fields
      if (formData.savingThrows.length > 0) {
        creatureData.savingThrows = {};
        formData.savingThrows.forEach(save => {
          creatureData.savingThrows[save.toLowerCase()] = parseInt(formData.proficiencyBonus);
        });
      }

      if (Object.keys(formData.skills).length > 0) {
        creatureData.skills = formData.skills;
      }

      if (formData.damageVulnerabilities) {
        creatureData.damageVulnerabilities = formData.damageVulnerabilities.split(',').map(s => s.trim());
      }
      if (formData.damageResistances) {
        creatureData.damageResistances = formData.damageResistances.split(',').map(s => s.trim());
      }
      if (formData.damageImmunities) {
        creatureData.damageImmunities = formData.damageImmunities.split(',').map(s => s.trim());
      }
      if (formData.conditionImmunities) {
        creatureData.conditionImmunities = formData.conditionImmunities.split(',').map(s => s.trim());
      }

      // Senses
      creatureData.senses = {
        passivePerception: parseInt(formData.passivePerception),
        darkvision: parseInt(formData.darkvision) || undefined,
        blindsight: parseInt(formData.blindsight) || undefined,
        truesight: parseInt(formData.truesight) || undefined,
        tremorsense: parseInt(formData.tremorsense) || undefined,
      };

      creatureData.languages = formData.languages.split(',').map(s => s.trim()).filter(Boolean);

      // Traits, Actions, Reactions
      if (formData.traits.length > 0) {
        creatureData.traits = formData.traits.filter(t => t.name.trim() !== '');
      }

      creatureData.actions = formData.actions.filter(a => a.name.trim() !== '');

      if (formData.reactions.length > 0) {
        creatureData.reactions = formData.reactions.filter(r => r.name.trim() !== '');
      }

      // Legendary Actions
      if (formData.hasLegendaryActions && formData.legendaryActions.length > 0) {
        creatureData.legendaryActions = {
          description: formData.legendaryActionDescription ||
            `The creature can take ${formData.legendaryActionsPerRound} legendary actions, choosing from the options below.`,
          actions: formData.legendaryActions.filter(la => la.name.trim() !== ''),
        };
      }

      const userId = 'temp-user-id';

      await createContentMutation.mutateAsync({
        userId,
        type: 'creature',
        name: formData.name,
        data: creatureData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create creature:', error);
      alert('Failed to create creature. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="3" style={{ padding: '2rem 1rem' }}>
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeftIcon />
            </Button>
            <Heading size="6">Create Creature</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Creature'}
          </Button>
        </Flex>

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <FormSection title="Basic Information">
            <Grid columns="2" gap="3">
              <Box style={{ gridColumn: '1 / -1' }}>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Creature Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Ancient Red Dragon"
                  required
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Size
                </Text>
                <Select.Root value={formData.size} onValueChange={(val) => updateField('size', val)}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="Tiny">Tiny</Select.Item>
                    <Select.Item value="Small">Small</Select.Item>
                    <Select.Item value="Medium">Medium</Select.Item>
                    <Select.Item value="Large">Large</Select.Item>
                    <Select.Item value="Huge">Huge</Select.Item>
                    <Select.Item value="Gargantuan">Gargantuan</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Type
                </Text>
                <TextField.Root
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  placeholder="e.g., dragon, humanoid (elf)"
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Alignment
                </Text>
                <TextField.Root
                  value={formData.alignment}
                  onChange={(e) => updateField('alignment', e.target.value)}
                  placeholder="e.g., chaotic evil"
                />
              </Box>
            </Grid>
          </FormSection>

          {/* AC and HP */}
          <FormSection title="Armor Class and Hit Points">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  AC
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.ac}
                  onChange={(e) => updateField('ac', e.target.value)}
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  AC Type
                </Text>
                <TextField.Root
                  value={formData.acType}
                  onChange={(e) => updateField('acType', e.target.value)}
                  placeholder="e.g., natural armor, plate"
                />
              </Box>
            </Grid>

            <Grid columns="4" gap="3" mt="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  HP (Avg)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.hpAverage}
                  onChange={(e) => updateField('hpAverage', e.target.value)}
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Dice Count
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.hpDiceCount}
                  onChange={(e) => updateField('hpDiceCount', e.target.value)}
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Dice Size
                </Text>
                <Select.Root value={formData.hpDiceSize} onValueChange={(val) => updateField('hpDiceSize', val)}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="4">d4</Select.Item>
                    <Select.Item value="6">d6</Select.Item>
                    <Select.Item value="8">d8</Select.Item>
                    <Select.Item value="10">d10</Select.Item>
                    <Select.Item value="12">d12</Select.Item>
                    <Select.Item value="20">d20</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Modifier
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.hpModifier}
                  onChange={(e) => updateField('hpModifier', e.target.value)}
                />
              </Box>
            </Grid>
          </FormSection>

          {/* Speed */}
          <FormSection title="Speed">
            <Grid columns="3" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Walk (ft)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speedWalk}
                  onChange={(e) => updateField('speedWalk', e.target.value)}
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Fly (ft)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speedFly}
                  onChange={(e) => updateField('speedFly', e.target.value)}
                  placeholder="0"
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Swim (ft)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speedSwim}
                  onChange={(e) => updateField('speedSwim', e.target.value)}
                  placeholder="0"
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Burrow (ft)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speedBurrow}
                  onChange={(e) => updateField('speedBurrow', e.target.value)}
                  placeholder="0"
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Climb (ft)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speedClimb}
                  onChange={(e) => updateField('speedClimb', e.target.value)}
                  placeholder="0"
                />
              </Box>
              <Box>
                <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                  <Switch
                    checked={formData.hover}
                    onCheckedChange={(checked) => updateField('hover', checked)}
                  />
                  <Text size="2">Hover</Text>
                </Flex>
              </Box>
            </Grid>
          </FormSection>

          {/* Ability Scores */}
          <FormSection title="Ability Scores">
            <AbilityScoreInput
              value={formData.abilities}
              onChange={(val) => updateField('abilities', val)}
              showModifiers
            />
          </FormSection>

          {/* Challenge Rating */}
          <FormSection title="Challenge Rating">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  CR
                </Text>
                <TextField.Root
                  value={formData.cr}
                  onChange={(e) => updateField('cr', e.target.value)}
                  placeholder="e.g., 1, 1/2, 1/4"
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Proficiency Bonus
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.proficiencyBonus}
                  onChange={(e) => updateField('proficiencyBonus', e.target.value)}
                />
              </Box>
            </Grid>
          </FormSection>

          {/* Traits */}
          <FormSection title="Special Traits">
            <Flex justify="between" align="center" mb="3">
              <Text size="2" weight="medium">Traits</Text>
              <Button type="button" size="1" variant="soft" onClick={() => addItem('traits')}>
                <PlusIcon /> Add Trait
              </Button>
            </Flex>
            {formData.traits.map((trait, idx) => (
              <Box key={idx} mb="3" style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}>
                <Flex gap="2" mb="2">
                  <TextField.Root
                    value={trait.name}
                    onChange={(e) => updateItem('traits', idx, 'name', e.target.value)}
                    placeholder="Trait name"
                    style={{ flex: 1 }}
                  />
                  {formData.traits.length > 0 && (
                    <Button type="button" size="2" variant="soft" color="red" onClick={() => removeItem('traits', idx)}>
                      <TrashIcon />
                    </Button>
                  )}
                </Flex>
                <TextArea
                  value={trait.description}
                  onChange={(e) => updateItem('traits', idx, 'description', e.target.value)}
                  placeholder="Trait description"
                  rows={3}
                />
              </Box>
            ))}
          </FormSection>

          {/* Actions */}
          <FormSection title="Actions">
            <Flex justify="between" align="center" mb="3">
              <Text size="2" weight="medium">Actions</Text>
              <Button type="button" size="1" variant="soft" onClick={() => addItem('actions')}>
                <PlusIcon /> Add Action
              </Button>
            </Flex>
            {formData.actions.map((action, idx) => (
              <Box key={idx} mb="3" style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}>
                <Flex gap="2" mb="2">
                  <TextField.Root
                    value={action.name}
                    onChange={(e) => updateItem('actions', idx, 'name', e.target.value)}
                    placeholder="Action name"
                    style={{ flex: 1 }}
                  />
                  {formData.actions.length > 1 && (
                    <Button type="button" size="2" variant="soft" color="red" onClick={() => removeItem('actions', idx)}>
                      <TrashIcon />
                    </Button>
                  )}
                </Flex>
                <TextArea
                  value={action.description}
                  onChange={(e) => updateItem('actions', idx, 'description', e.target.value)}
                  placeholder="Action description"
                  rows={3}
                />
              </Box>
            ))}
          </FormSection>

          {/* Legendary Actions */}
          <FormSection title="Legendary Actions (Optional)">
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasLegendaryActions}
                onCheckedChange={(checked) => updateField('hasLegendaryActions', checked)}
              />
              <Text size="2">Has Legendary Actions</Text>
            </Flex>

            {formData.hasLegendaryActions && (
              <>
                <Flex justify="between" align="center" mb="3">
                  <Text size="2" weight="medium">Legendary Actions</Text>
                  <Button type="button" size="1" variant="soft" onClick={() => addItem('legendaryActions')}>
                    <PlusIcon /> Add Legendary Action
                  </Button>
                </Flex>
                {formData.legendaryActions.map((la, idx) => (
                  <Box key={idx} mb="3" style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}>
                    <Grid columns="2" gap="2" mb="2">
                      <TextField.Root
                        value={la.name}
                        onChange={(e) => updateItem('legendaryActions', idx, 'name', e.target.value)}
                        placeholder="Action name"
                      />
                      <Flex gap="2">
                        <TextField.Root
                          type="number"
                          value={la.cost.toString()}
                          onChange={(e) => updateItem('legendaryActions', idx, 'cost', parseInt(e.target.value) || 1)}
                          placeholder="Cost"
                          style={{ width: '80px' }}
                        />
                        <Button type="button" size="2" variant="soft" color="red" onClick={() => removeItem('legendaryActions', idx)}>
                          <TrashIcon />
                        </Button>
                      </Flex>
                    </Grid>
                    <TextArea
                      value={la.description}
                      onChange={(e) => updateItem('legendaryActions', idx, 'description', e.target.value)}
                      placeholder="Action description"
                      rows={2}
                    />
                  </Box>
                ))}
              </>
            )}
          </FormSection>

          {/* Description */}
          <FormSection title="Description">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe the creature's appearance, behavior, and tactics..."
              required
              rows={8}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={['undead', 'dragon', 'fiend', 'fey', 'aberration', 'legendary', 'boss', 'minion']}
            />
          </FormSection>

          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Creature'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
