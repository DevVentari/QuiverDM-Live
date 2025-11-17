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
} from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { trpc } from '@/lib/trpc';
import {
  RichTextEditor,
  TagSelector,
  FormSection,
} from '@/components/homebrew/forms';

interface FeatFormData {
  name: string;
  hasAbilityPrereq: boolean;
  abilityPrereqType: string;
  abilityPrereqValue: string;
  hasProficiencyPrereq: boolean;
  proficiencyPrereq: string;
  hasSpellcastingPrereq: boolean;
  hasLevelPrereq: boolean;
  levelPrereq: string;
  otherPrereq: string;
  hasASI: boolean;
  asiCount: string;
  asiMax: string;
  description: string;
  repeatable: boolean;
  tags: string[];
}

export default function CreateFeatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FeatFormData>({
    name: '',
    hasAbilityPrereq: false,
    abilityPrereqType: 'STR',
    abilityPrereqValue: '13',
    hasProficiencyPrereq: false,
    proficiencyPrereq: '',
    hasSpellcastingPrereq: false,
    hasLevelPrereq: false,
    levelPrereq: '',
    otherPrereq: '',
    hasASI: false,
    asiCount: '1',
    asiMax: '1',
    description: '',
    repeatable: false,
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof FeatFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const featData: any = {
        description: formData.description,
        repeatable: formData.repeatable,
      };

      // Build prerequisites object
      const prerequisites: any = {};

      if (formData.hasAbilityPrereq) {
        prerequisites.ability = {
          [formData.abilityPrereqType]: parseInt(formData.abilityPrereqValue),
        };
      }

      if (formData.hasProficiencyPrereq && formData.proficiencyPrereq) {
        prerequisites.proficiency = [formData.proficiencyPrereq];
      }

      if (formData.hasSpellcastingPrereq) {
        prerequisites.spellcasting = true;
      }

      if (formData.hasLevelPrereq && formData.levelPrereq) {
        prerequisites.level = parseInt(formData.levelPrereq);
      }

      if (formData.otherPrereq) {
        prerequisites.other = formData.otherPrereq;
      }

      if (Object.keys(prerequisites).length > 0) {
        featData.prerequisites = prerequisites;
      }

      // Ability score increase
      if (formData.hasASI) {
        featData.abilityScoreIncrease = {
          count: parseInt(formData.asiCount) || 1,
          max: parseInt(formData.asiMax) || 1,
          choices: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
        };
      }

      const userId = 'temp-user-id'; // Replace with actual user ID from session

      await createContentMutation.mutateAsync({
        userId,
        type: 'feat',
        name: formData.name,
        data: featData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create feat:', error);
      alert('Failed to create feat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="3" style={{ padding: '2rem 1rem' }}>
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeftIcon />
            </Button>
            <Heading size="6">Create Feat</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Feat'}
          </Button>
        </Flex>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <FormSection title="Basic Information" description="Feat name and general properties">
            <Box mb="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Feat Name <span style={{ color: 'var(--red-9)' }}>*</span>
              </Text>
              <TextField.Root
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Great Weapon Master"
                required
              />
            </Box>

            <Flex align="center" gap="2">
              <Switch
                checked={formData.repeatable}
                onCheckedChange={(checked) => updateField('repeatable', checked)}
              />
              <Text size="2">Can be taken multiple times</Text>
            </Flex>
          </FormSection>

          {/* Prerequisites */}
          <FormSection title="Prerequisites" description="Requirements to take this feat">
            {/* Ability Score Prerequisite */}
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasAbilityPrereq}
                onCheckedChange={(checked) => updateField('hasAbilityPrereq', checked)}
              />
              <Text size="2">Ability Score Requirement</Text>
            </Flex>

            {formData.hasAbilityPrereq && (
              <Grid columns="2" gap="3" mb="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Ability
                  </Text>
                  <Select.Root
                    value={formData.abilityPrereqType}
                    onValueChange={(val) => updateField('abilityPrereqType', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="STR">Strength</Select.Item>
                      <Select.Item value="DEX">Dexterity</Select.Item>
                      <Select.Item value="CON">Constitution</Select.Item>
                      <Select.Item value="INT">Intelligence</Select.Item>
                      <Select.Item value="WIS">Wisdom</Select.Item>
                      <Select.Item value="CHA">Charisma</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Minimum Score
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.abilityPrereqValue}
                    onChange={(e) => updateField('abilityPrereqValue', e.target.value)}
                    placeholder="e.g., 13"
                  />
                </Box>
              </Grid>
            )}

            {/* Proficiency Prerequisite */}
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasProficiencyPrereq}
                onCheckedChange={(checked) => updateField('hasProficiencyPrereq', checked)}
              />
              <Text size="2">Proficiency Requirement</Text>
            </Flex>

            {formData.hasProficiencyPrereq && (
              <Box mb="3">
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Required Proficiency
                </Text>
                <TextField.Root
                  value={formData.proficiencyPrereq}
                  onChange={(e) => updateField('proficiencyPrereq', e.target.value)}
                  placeholder="e.g., Heavy armor proficiency"
                />
              </Box>
            )}

            {/* Spellcasting Prerequisite */}
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasSpellcastingPrereq}
                onCheckedChange={(checked) => updateField('hasSpellcastingPrereq', checked)}
              />
              <Text size="2">Requires Spellcasting</Text>
            </Flex>

            {/* Level Prerequisite */}
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasLevelPrereq}
                onCheckedChange={(checked) => updateField('hasLevelPrereq', checked)}
              />
              <Text size="2">Minimum Level Requirement</Text>
            </Flex>

            {formData.hasLevelPrereq && (
              <Box mb="3">
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Minimum Level
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.levelPrereq}
                  onChange={(e) => updateField('levelPrereq', e.target.value)}
                  placeholder="e.g., 4"
                />
              </Box>
            )}

            {/* Other Prerequisites */}
            <Box>
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Other Prerequisites
              </Text>
              <TextField.Root
                value={formData.otherPrereq}
                onChange={(e) => updateField('otherPrereq', e.target.value)}
                placeholder="e.g., Must be a member of the Zhentarim"
              />
              <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                Freeform text for additional requirements
              </Text>
            </Box>
          </FormSection>

          {/* Ability Score Increase */}
          <FormSection
            title="Ability Score Increase"
            description="Does this feat grant an ability score increase?"
          >
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasASI}
                onCheckedChange={(checked) => updateField('hasASI', checked)}
              />
              <Text size="2">Grants Ability Score Increase</Text>
            </Flex>

            {formData.hasASI && (
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Number of Increases
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.asiCount}
                    onChange={(e) => updateField('asiCount', e.target.value)}
                    placeholder="e.g., 1"
                  />
                  <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                    How many ability scores can be increased
                  </Text>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Maximum Increase
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.asiMax}
                    onChange={(e) => updateField('asiMax', e.target.value)}
                    placeholder="e.g., 1"
                  />
                  <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                    Maximum points per ability score (usually 1)
                  </Text>
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Description */}
          <FormSection title="Feat Description" description="Full description of the feat's benefits">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe what benefits this feat provides, including any special abilities, bonuses, or features..."
              required
              rows={12}
              helpText="Include all mechanical benefits and any narrative flavor"
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags" description="Add tags for easier searching">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'combat',
                'magic',
                'skill',
                'utility',
                'social',
                'defensive',
                'offensive',
                'mobility',
                'asi',
                'racial',
              ]}
            />
          </FormSection>

          {/* Submit */}
          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Feat'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
