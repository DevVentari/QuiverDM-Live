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
  ProficiencySelector,
  DND_SKILLS,
  DND_TOOLS,
} from '@/components/homebrew/forms';

interface BackgroundFormData {
  name: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languageCount: number;
  specificLanguages: string[];
  equipment: string[];
  startingGold: string;
  featureName: string;
  featureDescription: string;
  description: string;
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  variantName: string;
  variantDescription: string;
  tags: string[];
}

export default function CreateBackgroundPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BackgroundFormData>({
    name: '',
    skillProficiencies: [],
    toolProficiencies: [],
    languageCount: 0,
    specificLanguages: [],
    equipment: [''],
    startingGold: '',
    featureName: '',
    featureDescription: '',
    description: '',
    personalityTraits: ['', '', '', '', '', '', '', ''],
    ideals: ['', '', '', '', '', ''],
    bonds: ['', '', '', '', '', ''],
    flaws: ['', '', '', '', '', ''],
    variantName: '',
    variantDescription: '',
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof BackgroundFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateArrayItem = (
    field: keyof BackgroundFormData,
    index: number,
    value: string
  ) => {
    const array = [...(formData[field] as string[])];
    array[index] = value;
    updateField(field, array);
  };

  const addArrayItem = (field: keyof BackgroundFormData) => {
    const array = [...(formData[field] as string[])];
    array.push('');
    updateField(field, array);
  };

  const removeArrayItem = (field: keyof BackgroundFormData, index: number) => {
    const array = [...(formData[field] as string[])];
    array.splice(index, 1);
    updateField(field, array);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const backgroundData: any = {
        skillProficiencies: formData.skillProficiencies,
        toolProficiencies: formData.toolProficiencies.length > 0 ? formData.toolProficiencies : undefined,
        equipment: formData.equipment.filter((e) => e.trim() !== ''),
        startingGold: formData.startingGold ? parseInt(formData.startingGold) : undefined,
        feature: {
          name: formData.featureName,
          description: formData.featureDescription,
        },
        description: formData.description,
      };

      if (formData.languageCount > 0 || formData.specificLanguages.length > 0) {
        backgroundData.languages = {
          count: formData.languageCount,
          specific: formData.specificLanguages.length > 0 ? formData.specificLanguages : undefined,
        };
      }

      // Filter out empty entries for suggested characteristics
      const personalityTraits = formData.personalityTraits.filter((t) => t.trim() !== '');
      const ideals = formData.ideals.filter((i) => i.trim() !== '');
      const bonds = formData.bonds.filter((b) => b.trim() !== '');
      const flaws = formData.flaws.filter((f) => f.trim() !== '');

      if (
        personalityTraits.length > 0 ||
        ideals.length > 0 ||
        bonds.length > 0 ||
        flaws.length > 0
      ) {
        backgroundData.suggestedCharacteristics = {
          personalityTraits,
          ideals,
          bonds,
          flaws,
        };
      }

      if (formData.variantName && formData.variantDescription) {
        backgroundData.variant = {
          name: formData.variantName,
          description: formData.variantDescription,
        };
      }

      const userId = 'temp-user-id'; // Replace with actual user ID from session

      await createContentMutation.mutateAsync({
        userId,
        type: 'background',
        name: formData.name,
        data: backgroundData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create background:', error);
      alert('Failed to create background. Please try again.');
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
            <Heading size="6">Create Background</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Background'}
          </Button>
        </Flex>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <FormSection title="Basic Information" description="Background name and description">
            <Box mb="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Background Name <span style={{ color: 'var(--red-9)' }}>*</span>
              </Text>
              <TextField.Root
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Soldier, Noble, Criminal"
                required
              />
            </Box>

            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              label="Description"
              placeholder="Describe the background's history, common origins, and thematic elements..."
              required
              rows={8}
            />
          </FormSection>

          {/* Proficiencies */}
          <FormSection title="Proficiencies" description="Skills, tools, and languages gained">
            <ProficiencySelector
              value={formData.skillProficiencies}
              onChange={(val) => updateField('skillProficiencies', val)}
              options={DND_SKILLS}
              label="Skill Proficiencies *"
              required
              columns={3}
            />

            <Box mt="3">
              <ProficiencySelector
                value={formData.toolProficiencies}
                onChange={(val) => updateField('toolProficiencies', val)}
                options={DND_TOOLS}
                label="Tool Proficiencies"
                columns={2}
              />
            </Box>

            <Box mt="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Additional Languages
              </Text>
              <TextField.Root
                type="number"
                min="0"
                max="10"
                value={formData.languageCount.toString()}
                onChange={(e) => updateField('languageCount', parseInt(e.target.value) || 0)}
                placeholder="Number of additional languages"
              />
              <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                How many additional languages the character can choose
              </Text>
            </Box>
          </FormSection>

          {/* Equipment */}
          <FormSection title="Starting Equipment" description="Items and gold provided by this background">
            <Box mb="3">
              <Flex justify="between" align="center" mb="2">
                <Text size="2" weight="medium">
                  Equipment
                </Text>
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  onClick={() => addArrayItem('equipment')}
                >
                  <PlusIcon /> Add Item
                </Button>
              </Flex>
              {formData.equipment.map((item, index) => (
                <Flex key={index} gap="2" mb="2">
                  <TextField.Root
                    value={item}
                    onChange={(e) => updateArrayItem('equipment', index, e.target.value)}
                    placeholder="e.g., A set of common clothes"
                    style={{ flex: 1 }}
                  />
                  {formData.equipment.length > 1 && (
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      color="red"
                      onClick={() => removeArrayItem('equipment', index)}
                    >
                      <TrashIcon />
                    </Button>
                  )}
                </Flex>
              ))}
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Starting Gold (gp)
              </Text>
              <TextField.Root
                type="number"
                value={formData.startingGold}
                onChange={(e) => updateField('startingGold', e.target.value)}
                placeholder="e.g., 10"
              />
            </Box>
          </FormSection>

          {/* Background Feature */}
          <FormSection title="Background Feature" description="The special feature gained from this background">
            <Box mb="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Feature Name <span style={{ color: 'var(--red-9)' }}>*</span>
              </Text>
              <TextField.Root
                value={formData.featureName}
                onChange={(e) => updateField('featureName', e.target.value)}
                placeholder="e.g., Military Rank, Position of Privilege"
                required
              />
            </Box>

            <RichTextEditor
              value={formData.featureDescription}
              onChange={(val) => updateField('featureDescription', val)}
              label="Feature Description *"
              placeholder="Describe what the feature does and how it benefits the character..."
              required
              rows={6}
            />
          </FormSection>

          {/* Suggested Characteristics */}
          <FormSection
            title="Suggested Characteristics"
            description="Optional personality traits, ideals, bonds, and flaws"
          >
            <Text size="1" color="gray" mb="3" style={{ display: 'block' }}>
              Provide suggestions for roleplaying this background. Players can roll or choose from these options.
            </Text>

            {/* Personality Traits */}
            <Box mb="4">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Personality Traits (d8)
              </Text>
              <Grid columns="1" gap="2">
                {formData.personalityTraits.map((trait, index) => (
                  <TextField.Root
                    key={index}
                    value={trait}
                    onChange={(e) => updateArrayItem('personalityTraits', index, e.target.value)}
                    placeholder={`${index + 1}. Personality trait`}
                  />
                ))}
              </Grid>
            </Box>

            {/* Ideals */}
            <Box mb="4">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Ideals (d6)
              </Text>
              <Grid columns="1" gap="2">
                {formData.ideals.map((ideal, index) => (
                  <TextField.Root
                    key={index}
                    value={ideal}
                    onChange={(e) => updateArrayItem('ideals', index, e.target.value)}
                    placeholder={`${index + 1}. Ideal`}
                  />
                ))}
              </Grid>
            </Box>

            {/* Bonds */}
            <Box mb="4">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Bonds (d6)
              </Text>
              <Grid columns="1" gap="2">
                {formData.bonds.map((bond, index) => (
                  <TextField.Root
                    key={index}
                    value={bond}
                    onChange={(e) => updateArrayItem('bonds', index, e.target.value)}
                    placeholder={`${index + 1}. Bond`}
                  />
                ))}
              </Grid>
            </Box>

            {/* Flaws */}
            <Box mb="4">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Flaws (d6)
              </Text>
              <Grid columns="1" gap="2">
                {formData.flaws.map((flaw, index) => (
                  <TextField.Root
                    key={index}
                    value={flaw}
                    onChange={(e) => updateArrayItem('flaws', index, e.target.value)}
                    placeholder={`${index + 1}. Flaw`}
                  />
                ))}
              </Grid>
            </Box>
          </FormSection>

          {/* Variant (Optional) */}
          <FormSection title="Variant (Optional)" description="Alternative version of this background">
            <Box mb="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Variant Name
              </Text>
              <TextField.Root
                value={formData.variantName}
                onChange={(e) => updateField('variantName', e.target.value)}
                placeholder="e.g., Knight (Noble Variant)"
              />
            </Box>

            <RichTextEditor
              value={formData.variantDescription}
              onChange={(val) => updateField('variantDescription', val)}
              label="Variant Description"
              placeholder="Describe how this variant differs from the base background..."
              rows={4}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags" description="Add tags for easier searching">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'social',
                'criminal',
                'noble',
                'military',
                'religious',
                'scholar',
                'wilderness',
                'urban',
                'maritime',
              ]}
            />
          </FormSection>

          {/* Submit */}
          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Background'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
