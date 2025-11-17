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
} from '@/components/homebrew/forms';

interface Feature {
  level: number;
  name: string;
  description: string;
}

interface SubclassFormData {
  name: string;
  parentClass: string;
  subclassType: string;
  description: string;
  features: Feature[];
  spellsByLevel: Record<number, string[]>;
  tags: string[];
}

export default function CreateSubclassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SubclassFormData>({
    name: '',
    parentClass: 'Fighter',
    subclassType: 'Martial Archetype',
    description: '',
    features: [{ level: 3, name: '', description: '' }],
    spellsByLevel: {},
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof SubclassFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    const newFeature = { level: 3, name: '', description: '' };
    updateField('features', [...formData.features, newFeature]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const subclassData: any = {
        parentClass: formData.parentClass,
        subclassType: formData.subclassType,
        description: formData.description,
        features: formData.features
          .filter((f) => f.name.trim() !== '')
          .sort((a, b) => a.level - b.level),
      };

      // Add spells if any are defined
      const spellsByLevel: Record<number, string[]> = {};
      Object.entries(formData.spellsByLevel).forEach(([level, spells]) => {
        const spellList = spells.filter((s) => s.trim() !== '');
        if (spellList.length > 0) {
          spellsByLevel[parseInt(level)] = spellList;
        }
      });

      if (Object.keys(spellsByLevel).length > 0) {
        subclassData.spellsByLevel = spellsByLevel;
      }

      const userId = 'temp-user-id';

      await createContentMutation.mutateAsync({
        userId,
        type: 'subclass',
        name: formData.name,
        data: subclassData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create subclass:', error);
      alert('Failed to create subclass. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const classOptions = [
    { value: 'Barbarian', type: 'Primal Path' },
    { value: 'Bard', type: 'Bard College' },
    { value: 'Cleric', type: 'Divine Domain' },
    { value: 'Druid', type: 'Druid Circle' },
    { value: 'Fighter', type: 'Martial Archetype' },
    { value: 'Monk', type: 'Monastic Tradition' },
    { value: 'Paladin', type: 'Sacred Oath' },
    { value: 'Ranger', type: 'Ranger Archetype' },
    { value: 'Rogue', type: 'Roguish Archetype' },
    { value: 'Sorcerer', type: 'Sorcerous Origin' },
    { value: 'Warlock', type: 'Otherworldly Patron' },
    { value: 'Wizard', type: 'Arcane Tradition' },
  ];

  const updateSubclassType = (className: string) => {
    const classOption = classOptions.find((c) => c.value === className);
    if (classOption) {
      updateField('subclassType', classOption.type);
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
            <Heading size="6">Create Subclass</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Subclass'}
          </Button>
        </Flex>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <FormSection title="Basic Information">
            <Grid columns="2" gap="3">
              <Box style={{ gridColumn: '1 / -1' }}>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Subclass Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Way of the Shadow, Circle of the Moon"
                  required
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Parent Class <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root
                  value={formData.parentClass}
                  onValueChange={(val) => {
                    updateField('parentClass', val);
                    updateSubclassType(val);
                  }}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {classOptions.map((cls) => (
                      <Select.Item key={cls.value} value={cls.value}>
                        {cls.value}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Subclass Type
                </Text>
                <TextField.Root
                  value={formData.subclassType}
                  onChange={(e) => updateField('subclassType', e.target.value)}
                  placeholder="e.g., Martial Archetype"
                />
                <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                  Auto-filled based on parent class
                </Text>
              </Box>
            </Grid>
          </FormSection>

          {/* Description */}
          <FormSection title="Description">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe the subclass theme, philosophy, and general features..."
              required
              rows={8}
            />
          </FormSection>

          {/* Features */}
          <FormSection title="Subclass Features">
            <Text size="1" color="gray" mb="3" style={{ display: 'block' }}>
              Add features gained at each level
            </Text>
            <Flex justify="between" align="center" mb="3">
              <Text size="2" weight="medium">
                Features by Level
              </Text>
              <Button type="button" size="1" variant="soft" onClick={addFeature}>
                <PlusIcon /> Add Feature
              </Button>
            </Flex>

            {formData.features.map((feature, index) => (
              <Box
                key={index}
                mb="3"
                style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}
              >
                <Grid columns="2" gap="2" mb="2">
                  <TextField.Root
                    type="number"
                    value={feature.level.toString()}
                    onChange={(e) =>
                      updateFeature(index, 'level', parseInt(e.target.value) || 1)
                    }
                    placeholder="Level"
                    min="1"
                    max="20"
                    style={{ width: '100px' }}
                  />
                  <Flex gap="2" align="center">
                    <TextField.Root
                      value={feature.name}
                      onChange={(e) => updateFeature(index, 'name', e.target.value)}
                      placeholder="Feature name"
                      style={{ flex: 1 }}
                    />
                    {formData.features.length > 1 && (
                      <Button
                        type="button"
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => removeFeature(index)}
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </Flex>
                </Grid>
                <TextArea
                  value={feature.description}
                  onChange={(e) => updateFeature(index, 'description', e.target.value)}
                  placeholder="Feature description"
                  rows={4}
                />
              </Box>
            ))}
          </FormSection>

          {/* Spells (Optional) */}
          <FormSection
            title="Subclass Spells (Optional)"
            description="For subclasses that grant additional spells"
          >
            <Text size="1" color="gray" mb="3" style={{ display: 'block' }}>
              Enter spell names for each character level (comma-separated)
            </Text>
            <Grid columns="2" gap="3">
              {[1, 3, 5, 7, 9, 11, 13, 15, 17].map((level) => (
                <Box key={level}>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Level {level}
                  </Text>
                  <TextField.Root
                    value={(formData.spellsByLevel[level] || []).join(', ')}
                    onChange={(e) => {
                      const spells = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      updateField('spellsByLevel', {
                        ...formData.spellsByLevel,
                        [level]: spells,
                      });
                    }}
                    placeholder="e.g., Shield, Magic Missile"
                  />
                </Box>
              ))}
            </Grid>
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'martial',
                'spellcaster',
                'tank',
                'damage',
                'support',
                'control',
                'stealth',
                'utility',
              ]}
            />
          </FormSection>

          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Subclass'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
