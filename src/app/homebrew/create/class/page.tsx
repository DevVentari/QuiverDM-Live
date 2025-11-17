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
  TagSelector,
  FormSection,
  ProficiencySelector,
  DND_SKILLS,
  DND_ARMOR,
  DND_WEAPONS,
  DND_TOOLS,
} from '@/components/homebrew/forms';

interface Feature {
  level: number;
  name: string;
  description: string;
}

interface ClassFormData {
  name: string;
  hitDice: string;
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  savingThrowProficiencies: string[];
  skillCount: string;
  skillOptions: string[];
  startingEquipment: string[];
  features: Feature[];
  subclassLevel: string;
  subclassName: string;
  hasSpellcasting: boolean;
  spellcastingAbility: string;
  description: string;
  tags: string[];
}

export default function CreateClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ClassFormData>({
    name: '',
    hitDice: '8',
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    savingThrowProficiencies: [],
    skillCount: '2',
    skillOptions: [],
    startingEquipment: [''],
    features: [{ level: 1, name: '', description: '' }],
    subclassLevel: '3',
    subclassName: 'Archetype',
    hasSpellcasting: false,
    spellcastingAbility: 'INT',
    description: '',
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof ClassFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    updateField('features', [...formData.features, { level: 1, name: '', description: '' }]);
  };

  const updateFeature = (index: number, field: keyof Feature, value: any) => {
    const features = [...formData.features];
    features[index] = { ...features[index], [field]: value };
    updateField('features', features);
  };

  const removeFeature = (index: number) => {
    const features = [...formData.features];
    features.splice(index, 1);
    updateField('features', features);
  };

  const updateEquipment = (index: number, value: string) => {
    const equipment = [...formData.startingEquipment];
    equipment[index] = value;
    updateField('startingEquipment', equipment);
  };

  const addEquipment = () => {
    updateField('startingEquipment', [...formData.startingEquipment, '']);
  };

  const removeEquipment = (index: number) => {
    const equipment = [...formData.startingEquipment];
    equipment.splice(index, 1);
    updateField('startingEquipment', equipment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const classData: any = {
        hitDice: parseInt(formData.hitDice),
        hitPointsAtFirstLevel: parseInt(formData.hitDice) + 10,
        hitPointsAtHigherLevels: `1d${formData.hitDice} (or ${Math.floor(parseInt(formData.hitDice) / 2) + 1}) + your Constitution modifier per level`,
        armorProficiencies: formData.armorProficiencies,
        weaponProficiencies: formData.weaponProficiencies,
        toolProficiencies: formData.toolProficiencies.length > 0 ? formData.toolProficiencies : undefined,
        savingThrowProficiencies: formData.savingThrowProficiencies,
        skillProficiencies: {
          count: parseInt(formData.skillCount),
          options: formData.skillOptions,
        },
        startingEquipment: formData.startingEquipment.filter((e) => e.trim() !== ''),
        features: formData.features
          .filter((f) => f.name.trim() !== '')
          .sort((a, b) => a.level - b.level),
        subclassLevel: parseInt(formData.subclassLevel),
        subclassName: formData.subclassName,
        description: formData.description,
      };

      if (formData.hasSpellcasting) {
        classData.spellcasting = {
          ability: formData.spellcastingAbility,
          ritual: false,
        };
      }

      await createContentMutation.mutateAsync({
        type: 'class',
        name: formData.name,
        data: classData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create class:', error);
      alert('Failed to create class. Please try again.');
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
            <Heading size="6">Create Class</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Class'}
          </Button>
        </Flex>

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <FormSection title="Basic Information">
            <Grid columns="2" gap="3">
              <Box style={{ gridColumn: '1 / -1' }}>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Class Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Warrior, Elementalist"
                  required
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Hit Dice <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root value={formData.hitDice} onValueChange={(val) => updateField('hitDice', val)}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="6">d6</Select.Item>
                    <Select.Item value="8">d8</Select.Item>
                    <Select.Item value="10">d10</Select.Item>
                    <Select.Item value="12">d12</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
            </Grid>
          </FormSection>

          {/* Proficiencies */}
          <FormSection title="Proficiencies">
            <ProficiencySelector
              value={formData.armorProficiencies}
              onChange={(val) => updateField('armorProficiencies', val)}
              options={DND_ARMOR}
              label="Armor Proficiencies"
              columns={2}
            />

            <Box mt="3">
              <ProficiencySelector
                value={formData.weaponProficiencies}
                onChange={(val) => updateField('weaponProficiencies', val)}
                options={['Simple weapons', 'Martial weapons', ...DND_WEAPONS.slice(2)]}
                label="Weapon Proficiencies *"
                required
                columns={2}
              />
            </Box>

            <Box mt="3">
              <ProficiencySelector
                value={formData.toolProficiencies}
                onChange={(val) => updateField('toolProficiencies', val)}
                options={DND_TOOLS.slice(0, 15)}
                label="Tool Proficiencies"
                columns={2}
              />
            </Box>

            <Box mt="3">
              <ProficiencySelector
                value={formData.savingThrowProficiencies}
                onChange={(val) => updateField('savingThrowProficiencies', val)}
                options={['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']}
                label="Saving Throw Proficiencies *"
                required
                columns={3}
              />
            </Box>

            <Box mt="3">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Skill Proficiencies *
              </Text>
              <Grid columns="2" gap="3" mb="2">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Number of Skills to Choose
                  </Text>
                  <TextField.Root
                    type="number"
                    min="2"
                    max="4"
                    value={formData.skillCount}
                    onChange={(e) => updateField('skillCount', e.target.value)}
                  />
                </Box>
              </Grid>
              <ProficiencySelector
                value={formData.skillOptions}
                onChange={(val) => updateField('skillOptions', val)}
                options={DND_SKILLS}
                label="Available Skill Options *"
                required
                columns={3}
              />
            </Box>
          </FormSection>

          {/* Starting Equipment */}
          <FormSection title="Starting Equipment">
            <Flex justify="between" align="center" mb="2">
              <Text size="2" weight="medium">Equipment</Text>
              <Button type="button" size="1" variant="soft" onClick={addEquipment}>
                <PlusIcon /> Add Item
              </Button>
            </Flex>
            {formData.startingEquipment.map((item, idx) => (
              <Flex key={idx} gap="2" mb="2">
                <TextField.Root
                  value={item}
                  onChange={(e) => updateEquipment(idx, e.target.value)}
                  placeholder="e.g., (a) a martial weapon and a shield or (b) two martial weapons"
                  style={{ flex: 1 }}
                />
                {formData.startingEquipment.length > 1 && (
                  <Button type="button" size="2" variant="soft" color="red" onClick={() => removeEquipment(idx)}>
                    <TrashIcon />
                  </Button>
                )}
              </Flex>
            ))}
          </FormSection>

          {/* Features */}
          <FormSection title="Class Features">
            <Flex justify="between" align="center" mb="3">
              <Text size="2" weight="medium">Features by Level</Text>
              <Button type="button" size="1" variant="soft" onClick={addFeature}>
                <PlusIcon /> Add Feature
              </Button>
            </Flex>
            {formData.features.map((feature, idx) => (
              <Box key={idx} mb="3" style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}>
                <Grid columns="2" gap="2" mb="2">
                  <TextField.Root
                    type="number"
                    value={feature.level.toString()}
                    onChange={(e) => updateFeature(idx, 'level', parseInt(e.target.value) || 1)}
                    placeholder="Level"
                    min="1"
                    max="20"
                    style={{ width: '100px' }}
                  />
                  <Flex gap="2">
                    <TextField.Root
                      value={feature.name}
                      onChange={(e) => updateFeature(idx, 'name', e.target.value)}
                      placeholder="Feature name"
                      style={{ flex: 1 }}
                    />
                    {formData.features.length > 1 && (
                      <Button type="button" size="2" variant="soft" color="red" onClick={() => removeFeature(idx)}>
                        <TrashIcon />
                      </Button>
                    )}
                  </Flex>
                </Grid>
                <TextArea
                  value={feature.description}
                  onChange={(e) => updateFeature(idx, 'description', e.target.value)}
                  placeholder="Feature description"
                  rows={4}
                />
              </Box>
            ))}
          </FormSection>

          {/* Subclass */}
          <FormSection title="Subclass">
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Subclass Level
                </Text>
                <TextField.Root
                  type="number"
                  min="1"
                  max="20"
                  value={formData.subclassLevel}
                  onChange={(e) => updateField('subclassLevel', e.target.value)}
                />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Subclass Name
                </Text>
                <TextField.Root
                  value={formData.subclassName}
                  onChange={(e) => updateField('subclassName', e.target.value)}
                  placeholder="e.g., Martial Archetype, Sacred Oath"
                />
              </Box>
            </Grid>
          </FormSection>

          {/* Spellcasting */}
          <FormSection title="Spellcasting (Optional)">
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasSpellcasting}
                onCheckedChange={(checked) => updateField('hasSpellcasting', checked)}
              />
              <Text size="2">This class can cast spells</Text>
            </Flex>

            {formData.hasSpellcasting && (
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Spellcasting Ability
                </Text>
                <Select.Root
                  value={formData.spellcastingAbility}
                  onValueChange={(val) => updateField('spellcastingAbility', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="INT">Intelligence</Select.Item>
                    <Select.Item value="WIS">Wisdom</Select.Item>
                    <Select.Item value="CHA">Charisma</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
            )}
          </FormSection>

          {/* Description */}
          <FormSection title="Description">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe the class theme, role, and playstyle..."
              required
              rows={10}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={['martial', 'spellcaster', 'half-caster', 'tank', 'damage', 'support', 'healer']}
            />
          </FormSection>

          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Class'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
