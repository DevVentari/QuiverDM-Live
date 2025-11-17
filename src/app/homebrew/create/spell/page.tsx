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
  Checkbox,
} from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { trpc } from '@/lib/trpc';
import {
  RichTextEditor,
  DiceInput,
  TagSelector,
  FormSection,
  ProficiencySelector,
} from '@/components/homebrew/forms';

interface SpellFormData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  ritual: boolean;
  range: string;
  hasAreaOfEffect: boolean;
  areaType: string;
  areaSize: string;
  componentsVerbal: boolean;
  componentsSomatic: boolean;
  componentsMaterial: boolean;
  materialComponents: string;
  materialCost: string;
  materialConsumed: boolean;
  duration: string;
  concentration: boolean;
  description: string;
  higherLevels: string;
  hasDamage: boolean;
  damageCount: number;
  damageSize: number;
  damageType: string;
  hasHealing: boolean;
  healingCount: number;
  healingSize: number;
  saveType: string;
  saveEffect: string;
  attackType: string;
  classes: string[];
  tags: string[];
}

export default function CreateSpellPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SpellFormData>({
    name: '',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    ritual: false,
    range: '30 feet',
    hasAreaOfEffect: false,
    areaType: 'sphere',
    areaSize: '20',
    componentsVerbal: true,
    componentsSomatic: true,
    componentsMaterial: false,
    materialComponents: '',
    materialCost: '',
    materialConsumed: false,
    duration: 'Instantaneous',
    concentration: false,
    description: '',
    higherLevels: '',
    hasDamage: false,
    damageCount: 1,
    damageSize: 6,
    damageType: 'fire',
    hasHealing: false,
    healingCount: 1,
    healingSize: 8,
    saveType: '',
    saveEffect: '',
    attackType: '',
    classes: [],
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof SpellFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const spellData: any = {
        level: formData.level,
        school: formData.school,
        castingTime: formData.castingTime,
        ritual: formData.ritual,
        range: formData.range,
        components: {
          verbal: formData.componentsVerbal,
          somatic: formData.componentsSomatic,
          material: formData.componentsMaterial,
          materialComponents: formData.materialComponents || undefined,
          materialCost: formData.materialCost ? parseFloat(formData.materialCost) : undefined,
          materialConsumed: formData.materialConsumed,
        },
        duration: formData.duration,
        concentration: formData.concentration,
        description: formData.description,
        higherLevels: formData.higherLevels || undefined,
        classes: formData.classes,
      };

      if (formData.hasAreaOfEffect) {
        spellData.areaOfEffect = {
          type: formData.areaType,
          size: parseInt(formData.areaSize),
        };
      }

      if (formData.hasDamage) {
        spellData.damage = {
          diceCount: formData.damageCount,
          diceSize: formData.damageSize,
          damageType: formData.damageType,
        };
      }

      if (formData.hasHealing) {
        spellData.healing = {
          diceCount: formData.healingCount,
          diceSize: formData.healingSize,
        };
      }

      if (formData.saveType) {
        spellData.saveType = formData.saveType;
        spellData.saveEffect = formData.saveEffect;
      }

      if (formData.attackType) {
        spellData.attackType = formData.attackType;
      }

      await createContentMutation.mutateAsync({
        type: 'spell',
        name: formData.name,
        data: spellData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create spell:', error);
      alert('Failed to create spell. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const spellClasses = [
    'Bard',
    'Cleric',
    'Druid',
    'Paladin',
    'Ranger',
    'Sorcerer',
    'Warlock',
    'Wizard',
    'Artificer',
  ];

  return (
    <Container size="3" style={{ padding: '2rem 1rem' }}>
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeftIcon />
            </Button>
            <Heading size="6">Create Spell</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Spell'}
          </Button>
        </Flex>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <FormSection title="Basic Information" description="Core spell details">
            <Grid columns="2" gap="3">
              <Box style={{ gridColumn: '1 / -1' }}>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Spell Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Fireball"
                  required
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Level <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root
                  value={formData.level.toString()}
                  onValueChange={(val) => updateField('level', parseInt(val))}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="0">Cantrip</Select.Item>
                    <Select.Item value="1">1st Level</Select.Item>
                    <Select.Item value="2">2nd Level</Select.Item>
                    <Select.Item value="3">3rd Level</Select.Item>
                    <Select.Item value="4">4th Level</Select.Item>
                    <Select.Item value="5">5th Level</Select.Item>
                    <Select.Item value="6">6th Level</Select.Item>
                    <Select.Item value="7">7th Level</Select.Item>
                    <Select.Item value="8">8th Level</Select.Item>
                    <Select.Item value="9">9th Level</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  School <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root
                  value={formData.school}
                  onValueChange={(val) => updateField('school', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="Abjuration">Abjuration</Select.Item>
                    <Select.Item value="Conjuration">Conjuration</Select.Item>
                    <Select.Item value="Divination">Divination</Select.Item>
                    <Select.Item value="Enchantment">Enchantment</Select.Item>
                    <Select.Item value="Evocation">Evocation</Select.Item>
                    <Select.Item value="Illusion">Illusion</Select.Item>
                    <Select.Item value="Necromancy">Necromancy</Select.Item>
                    <Select.Item value="Transmutation">Transmutation</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Casting Time
                </Text>
                <TextField.Root
                  value={formData.castingTime}
                  onChange={(e) => updateField('castingTime', e.target.value)}
                  placeholder="e.g., 1 action, 1 bonus action"
                />
              </Box>

              <Box>
                <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                  <Switch
                    checked={formData.ritual}
                    onCheckedChange={(checked) => updateField('ritual', checked)}
                  />
                  <Text size="2">Ritual</Text>
                </Flex>
              </Box>
            </Grid>
          </FormSection>

          {/* Range and Area */}
          <FormSection title="Range and Area" description="Spell targeting and area of effect">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Range
                </Text>
                <TextField.Root
                  value={formData.range}
                  onChange={(e) => updateField('range', e.target.value)}
                  placeholder="e.g., 30 feet, Self, Touch"
                />
              </Box>

              <Box>
                <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                  <Switch
                    checked={formData.hasAreaOfEffect}
                    onCheckedChange={(checked) => updateField('hasAreaOfEffect', checked)}
                  />
                  <Text size="2">Has Area of Effect</Text>
                </Flex>
              </Box>
            </Grid>

            {formData.hasAreaOfEffect && (
              <Grid columns="2" gap="3" mt="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Area Type
                  </Text>
                  <Select.Root
                    value={formData.areaType}
                    onValueChange={(val) => updateField('areaType', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="sphere">Sphere</Select.Item>
                      <Select.Item value="cube">Cube</Select.Item>
                      <Select.Item value="cone">Cone</Select.Item>
                      <Select.Item value="line">Line</Select.Item>
                      <Select.Item value="cylinder">Cylinder</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Size (feet)
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.areaSize}
                    onChange={(e) => updateField('areaSize', e.target.value)}
                    placeholder="e.g., 20"
                  />
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Components */}
          <FormSection title="Components" description="Spell components required">
            <Flex gap="4" mb="3">
              <Flex align="center" gap="2">
                <Checkbox
                  checked={formData.componentsVerbal}
                  onCheckedChange={(checked) => updateField('componentsVerbal', checked === true)}
                />
                <Text size="2">Verbal (V)</Text>
              </Flex>
              <Flex align="center" gap="2">
                <Checkbox
                  checked={formData.componentsSomatic}
                  onCheckedChange={(checked) => updateField('componentsSomatic', checked === true)}
                />
                <Text size="2">Somatic (S)</Text>
              </Flex>
              <Flex align="center" gap="2">
                <Checkbox
                  checked={formData.componentsMaterial}
                  onCheckedChange={(checked) => updateField('componentsMaterial', checked === true)}
                />
                <Text size="2">Material (M)</Text>
              </Flex>
            </Flex>

            {formData.componentsMaterial && (
              <Grid columns="2" gap="3">
                <Box style={{ gridColumn: '1 / -1' }}>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Material Components
                  </Text>
                  <TextField.Root
                    value={formData.materialComponents}
                    onChange={(e) => updateField('materialComponents', e.target.value)}
                    placeholder="e.g., a drop of water"
                  />
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Cost (gp)
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.materialCost}
                    onChange={(e) => updateField('materialCost', e.target.value)}
                    placeholder="e.g., 100"
                  />
                </Box>

                <Box>
                  <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                    <Switch
                      checked={formData.materialConsumed}
                      onCheckedChange={(checked) => updateField('materialConsumed', checked)}
                    />
                    <Text size="2">Consumed by spell</Text>
                  </Flex>
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Duration */}
          <FormSection title="Duration" description="How long the spell lasts">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Duration
                </Text>
                <TextField.Root
                  value={formData.duration}
                  onChange={(e) => updateField('duration', e.target.value)}
                  placeholder="e.g., Instantaneous, 1 minute, 1 hour"
                />
              </Box>

              <Box>
                <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                  <Switch
                    checked={formData.concentration}
                    onCheckedChange={(checked) => updateField('concentration', checked)}
                  />
                  <Text size="2">Requires Concentration</Text>
                </Flex>
              </Box>
            </Grid>
          </FormSection>

          {/* Damage and Healing */}
          <FormSection title="Damage and Healing" description="Spell effects">
            <Flex gap="4" mb="3">
              <Flex align="center" gap="2">
                <Switch
                  checked={formData.hasDamage}
                  onCheckedChange={(checked) => updateField('hasDamage', checked)}
                />
                <Text size="2">Deals Damage</Text>
              </Flex>
              <Flex align="center" gap="2">
                <Switch
                  checked={formData.hasHealing}
                  onCheckedChange={(checked) => updateField('hasHealing', checked)}
                />
                <Text size="2">Heals</Text>
              </Flex>
            </Flex>

            {formData.hasDamage && (
              <Grid columns="3" gap="3" mb="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Dice Count
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.damageCount.toString()}
                    onChange={(e) => updateField('damageCount', parseInt(e.target.value) || 1)}
                  />
                </Box>
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Dice Size
                  </Text>
                  <Select.Root
                    value={formData.damageSize.toString()}
                    onValueChange={(val) => updateField('damageSize', parseInt(val))}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="4">d4</Select.Item>
                      <Select.Item value="6">d6</Select.Item>
                      <Select.Item value="8">d8</Select.Item>
                      <Select.Item value="10">d10</Select.Item>
                      <Select.Item value="12">d12</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Damage Type
                  </Text>
                  <Select.Root
                    value={formData.damageType}
                    onValueChange={(val) => updateField('damageType', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="fire">Fire</Select.Item>
                      <Select.Item value="cold">Cold</Select.Item>
                      <Select.Item value="lightning">Lightning</Select.Item>
                      <Select.Item value="thunder">Thunder</Select.Item>
                      <Select.Item value="poison">Poison</Select.Item>
                      <Select.Item value="acid">Acid</Select.Item>
                      <Select.Item value="necrotic">Necrotic</Select.Item>
                      <Select.Item value="radiant">Radiant</Select.Item>
                      <Select.Item value="force">Force</Select.Item>
                      <Select.Item value="psychic">Psychic</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
              </Grid>
            )}

            {formData.hasHealing && (
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Healing Dice Count
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.healingCount.toString()}
                    onChange={(e) => updateField('healingCount', parseInt(e.target.value) || 1)}
                  />
                </Box>
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Healing Dice Size
                  </Text>
                  <Select.Root
                    value={formData.healingSize.toString()}
                    onValueChange={(val) => updateField('healingSize', parseInt(val))}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="4">d4</Select.Item>
                      <Select.Item value="6">d6</Select.Item>
                      <Select.Item value="8">d8</Select.Item>
                      <Select.Item value="10">d10</Select.Item>
                      <Select.Item value="12">d12</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Saving Throws and Attacks */}
          <FormSection title="Saving Throws and Attacks" description="Spell targeting mechanics">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Saving Throw
                </Text>
                <Select.Root
                  value={formData.saveType}
                  onValueChange={(val) => updateField('saveType', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="">None</Select.Item>
                    <Select.Item value="STR">Strength</Select.Item>
                    <Select.Item value="DEX">Dexterity</Select.Item>
                    <Select.Item value="CON">Constitution</Select.Item>
                    <Select.Item value="INT">Intelligence</Select.Item>
                    <Select.Item value="WIS">Wisdom</Select.Item>
                    <Select.Item value="CHA">Charisma</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              {formData.saveType && (
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Save Effect
                  </Text>
                  <TextField.Root
                    value={formData.saveEffect}
                    onChange={(e) => updateField('saveEffect', e.target.value)}
                    placeholder="e.g., half damage, no effect"
                  />
                </Box>
              )}

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Attack Type
                </Text>
                <Select.Root
                  value={formData.attackType}
                  onValueChange={(val) => updateField('attackType', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="">No attack roll</Select.Item>
                    <Select.Item value="melee">Melee Spell Attack</Select.Item>
                    <Select.Item value="ranged">Ranged Spell Attack</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
            </Grid>
          </FormSection>

          {/* Description */}
          <FormSection title="Description" description="Full spell description">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe what the spell does, its effects, and any special rules..."
              required
              rows={10}
            />

            <Box mt="3">
              <RichTextEditor
                value={formData.higherLevels}
                onChange={(val) => updateField('higherLevels', val)}
                label="At Higher Levels"
                placeholder="Describe what happens when cast at higher spell slot levels..."
                rows={4}
              />
            </Box>
          </FormSection>

          {/* Classes */}
          <FormSection title="Available Classes" description="Which classes can cast this spell">
            <ProficiencySelector
              value={formData.classes}
              onChange={(val) => updateField('classes', val)}
              options={spellClasses}
              columns={3}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags" description="Add tags for easier searching">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'damage',
                'healing',
                'buff',
                'debuff',
                'control',
                'utility',
                'ritual',
                'concentration',
                'attack-roll',
                'saving-throw',
              ]}
            />
          </FormSection>

          {/* Submit */}
          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Spell'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
