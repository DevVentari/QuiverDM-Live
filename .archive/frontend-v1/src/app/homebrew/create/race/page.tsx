'use client';
import { useRouter } from 'next/navigation';
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
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import {
  RichTextEditor,
  TagSelector,
  FormSection,
  ProficiencySelector,
  DND_LANGUAGES,
  DND_WEAPONS,
  DND_ARMOR,
  DND_TOOLS,
  DND_SKILLS,
} from '@/components/homebrew/forms';
import { useRaceForm } from '@/hooks/forms/useRaceForm';

export default function CreateRacePage() {
  const router = useRouter();
  const {
    formData,
    updateField,
    updateTrait,
    addTrait,
    removeTrait,
    updateSubraceOption,
    addSubraceOption,
    removeSubraceOption,
    submit,
    isSubmitting,
  } = useRaceForm({
    onSuccess: () => router.push('/homebrew'),
    onError: (message) => alert(message),
  });

  return (
    <Container size="3" style={{ padding: '2rem 1rem' }}>
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeftIcon />
            </Button>
            <Heading size="6">Create Race</Heading>
          </Flex>
          <Button onClick={() => submit()} disabled={isSubmitting || !formData.name}>
            {isSubmitting ? 'Creating...' : 'Create Race'}
          </Button>
        </Flex>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* Basic Information */}
          <FormSection title="Basic Information" description="Race name and physical attributes">
            <Grid columns="3" gap="3">
              <Box style={{ gridColumn: '1 / -1' }}>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Race Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Elf, Dwarf, Tiefling"
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
                    <Select.Item value="Small">Small</Select.Item>
                    <Select.Item value="Medium">Medium</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Speed (feet)
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.speed}
                  onChange={(e) => updateField('speed', e.target.value)}
                  placeholder="30"
                />
              </Box>
            </Grid>
          </FormSection>

          {/* Ability Score Increases */}
          <FormSection title="Ability Score Increases" description="Racial ability score bonuses">
            <Grid columns="6" gap="3" mb="3">
              {[
                { key: 'strIncrease', label: 'STR' },
                { key: 'dexIncrease', label: 'DEX' },
                { key: 'conIncrease', label: 'CON' },
                { key: 'intIncrease', label: 'INT' },
                { key: 'wisIncrease', label: 'WIS' },
                { key: 'chaIncrease', label: 'CHA' },
              ].map((ability) => (
                <Box key={ability.key}>
                  <Text size="2" weight="medium" mb="1" style={{ display: 'block', textAlign: 'center' }}>
                    {ability.label}
                  </Text>
                  <TextField.Root
                    type="number"
                    min="0"
                    max="2"
                    value={(formData as any)[ability.key]}
                    onChange={(e) => updateField(ability.key as keyof RaceFormData, e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </Box>
              ))}
            </Grid>

            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasChoiceASI}
                onCheckedChange={(checked) => updateField('hasChoiceASI', checked)}
              />
              <Text size="2">Player can choose additional ability score increases</Text>
            </Flex>

            {formData.hasChoiceASI && (
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Number of Choices
                  </Text>
                  <TextField.Root
                    type="number"
                    min="1"
                    value={formData.choiceCount}
                    onChange={(e) => updateField('choiceCount', e.target.value)}
                    placeholder="e.g., 2"
                  />
                  <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                    How many different abilities can be increased
                  </Text>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Amount per Choice
                  </Text>
                  <TextField.Root
                    type="number"
                    min="1"
                    max="2"
                    value={formData.choiceAmount}
                    onChange={(e) => updateField('choiceAmount', e.target.value)}
                    placeholder="e.g., 1"
                  />
                  <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                    Points added to each chosen ability (usually 1)
                  </Text>
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Age */}
          <FormSection title="Age" description="Maturity and lifespan">
            <Grid columns="2" gap="3" mb="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Age of Maturity
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.maturity}
                  onChange={(e) => updateField('maturity', e.target.value)}
                  placeholder="e.g., 18"
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Typical Lifespan
                </Text>
                <TextField.Root
                  type="number"
                  value={formData.lifespan}
                  onChange={(e) => updateField('lifespan', e.target.value)}
                  placeholder="e.g., 750"
                />
              </Box>
            </Grid>

            <Box>
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Age Description
              </Text>
              <TextField.Root
                value={formData.ageDescription}
                onChange={(e) => updateField('ageDescription', e.target.value)}
                placeholder="e.g., Elves reach adulthood around 100 years..."
              />
            </Box>
          </FormSection>

          {/* Languages */}
          <FormSection title="Languages" description="Languages known by this race">
            <ProficiencySelector
              value={formData.languages}
              onChange={(val) => updateField('languages', val)}
              options={DND_LANGUAGES}
              label="Known Languages"
              columns={3}
            />

            <Box mt="3">
              <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Additional Language Choices
              </Text>
              <TextField.Root
                type="number"
                min="0"
                value={formData.additionalLanguageChoices}
                onChange={(e) => updateField('additionalLanguageChoices', e.target.value)}
                placeholder="0"
              />
              <Text size="1" color="gray" style={{ display: 'block', marginTop: '0.25rem' }}>
                Number of additional languages the player can choose
              </Text>
            </Box>
          </FormSection>

          {/* Racial Traits */}
          <FormSection title="Racial Traits" description="Special abilities and features">
            <Flex justify="between" align="center" mb="3">
              <Text size="2" weight="medium">
                Traits
              </Text>
              <Button type="button" size="1" variant="soft" onClick={addTrait}>
                <PlusIcon /> Add Trait
              </Button>
            </Flex>

            {formData.traits.map((trait, index) => (
              <Box key={index} mb="3" style={{ padding: '1rem', background: 'var(--gray-2)', borderRadius: '8px' }}>
                <Grid columns="1" gap="2">
                  <Flex gap="2" align="center">
                    <TextField.Root
                      value={trait.name}
                      onChange={(e) => updateTrait(index, 'name', e.target.value)}
                      placeholder="Trait name (e.g., Darkvision)"
                      style={{ flex: 1 }}
                    />
                    {formData.traits.length > 1 && (
                      <Button
                        type="button"
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => removeTrait(index)}
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </Flex>
                  <TextField.Root
                    value={trait.description}
                    onChange={(e) => updateTrait(index, 'description', e.target.value)}
                    placeholder="Trait description"
                  />
                </Grid>
              </Box>
            ))}
          </FormSection>

          {/* Proficiencies */}
          <FormSection title="Proficiencies (Optional)" description="Weapon, armor, tool, and skill proficiencies">
            <ProficiencySelector
              value={formData.weaponProficiencies}
              onChange={(val) => updateField('weaponProficiencies', val)}
              options={DND_WEAPONS}
              label="Weapon Proficiencies"
              columns={2}
            />

            <Box mt="3">
              <ProficiencySelector
                value={formData.armorProficiencies}
                onChange={(val) => updateField('armorProficiencies', val)}
                options={DND_ARMOR}
                label="Armor Proficiencies"
                columns={2}
              />
            </Box>

            <Box mt="3">
              <ProficiencySelector
                value={formData.toolProficiencies}
                onChange={(val) => updateField('toolProficiencies', val)}
                options={DND_TOOLS.slice(0, 10)}
                label="Tool Proficiencies"
                columns={2}
              />
            </Box>

            <Box mt="3">
              <ProficiencySelector
                value={formData.skillProficiencies}
                onChange={(val) => updateField('skillProficiencies', val)}
                options={DND_SKILLS}
                label="Skill Proficiencies"
                columns={3}
              />
            </Box>

            <Box mt="3">
              <Text size="2" weight="medium" mb="2" style={{ display: 'block' }}>
                Skill Choice
              </Text>
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Number of Skills to Choose
                  </Text>
                  <TextField.Root
                    type="number"
                    min="0"
                    value={formData.skillChoiceCount}
                    onChange={(e) => updateField('skillChoiceCount', e.target.value)}
                    placeholder="0"
                  />
                </Box>
              </Grid>
              {parseInt(formData.skillChoiceCount) > 0 && (
                <Box mt="2">
                  <ProficiencySelector
                    value={formData.skillChoiceOptions}
                    onChange={(val) => updateField('skillChoiceOptions', val)}
                    options={DND_SKILLS}
                    label="Available Skill Options"
                    columns={3}
                  />
                </Box>
              )}
            </Box>
          </FormSection>

          {/* Subraces */}
          <FormSection title="Subraces" description="Does this race have subraces?">
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasSubraces}
                onCheckedChange={(checked) => updateField('hasSubraces', checked)}
              />
              <Text size="2">This race has subraces</Text>
            </Flex>

            {formData.hasSubraces && (
              <>
                <Flex justify="between" align="center" mb="2">
                  <Text size="2" weight="medium">
                    Subrace Names
                  </Text>
                  <Button type="button" size="1" variant="soft" onClick={addSubraceOption}>
                    <PlusIcon /> Add Subrace
                  </Button>
                </Flex>
                {formData.subraceOptions.map((subrace, index) => (
                  <Flex key={index} gap="2" mb="2">
                    <TextField.Root
                      value={subrace}
                      onChange={(e) => updateSubraceOption(index, e.target.value)}
                      placeholder="e.g., High Elf, Wood Elf"
                      style={{ flex: 1 }}
                    />
                    {formData.subraceOptions.length > 1 && (
                      <Button
                        type="button"
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => removeSubraceOption(index)}
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </Flex>
                ))}
                <Text size="1" color="gray" mt="2" style={{ display: 'block' }}>
                  Note: You&apos;ll need to create separate race entries for each subrace with their specific features
                </Text>
              </>
            )}
          </FormSection>

          {/* Description */}
          <FormSection title="Description" description="Physical description, culture, and lore">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe the race's appearance, culture, society, and place in the world..."
              required
              rows={10}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags" description="Add tags for easier searching">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'humanoid',
                'fey',
                'elemental',
                'darkvision',
                'spellcasting',
                'long-lived',
                'small',
                'underground',
              ]}
            />
          </FormSection>

          {/* Submit */}
          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name}>
              {isSubmitting ? 'Creating...' : 'Create Race'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
