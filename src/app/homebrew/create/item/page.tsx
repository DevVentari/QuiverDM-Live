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
  Card,
} from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { trpc } from '@/lib/trpc';
import {
  RichTextEditor,
  DiceInput,
  TagSelector,
  FormSection,
} from '@/components/homebrew/forms';

interface MagicItemFormData {
  name: string;
  itemType: string;
  rarity: string;
  requiresAttunement: boolean;
  attunementRequirements: string;
  weight: string;
  cost: string;

  // Weapon-specific
  weaponType: string;
  weaponCategory: string;
  damage: string;
  damageType: string;
  properties: string[];

  // Armor-specific
  armorType: string;
  baseAC: string;
  acBonus: string;
  strengthRequirement: string;
  stealthDisadvantage: boolean;

  // Magical properties
  hasCharges: boolean;
  chargesMax: string;
  chargesRecharge: string;

  // Description
  description: string;

  // Tags
  tags: string[];
}

export default function CreateMagicItemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MagicItemFormData>({
    name: '',
    itemType: 'wondrous',
    rarity: 'Common',
    requiresAttunement: false,
    attunementRequirements: '',
    weight: '',
    cost: '',
    weaponType: 'martial',
    weaponCategory: 'melee',
    damage: '',
    damageType: 'slashing',
    properties: [],
    armorType: 'light',
    baseAC: '',
    acBonus: '',
    strengthRequirement: '',
    stealthDisadvantage: false,
    hasCharges: false,
    chargesMax: '',
    chargesRecharge: '',
    description: '',
    tags: [],
  });

  const createContentMutation = trpc.homebrew.createContent.useMutation();

  const updateField = (field: keyof MagicItemFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build data object based on item type
      const itemData: any = {
        itemType: formData.itemType,
        rarity: formData.rarity,
        requiresAttunement: formData.requiresAttunement,
        attunementRequirements: formData.attunementRequirements || undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        cost: formData.cost || undefined,
        description: formData.description,
      };

      // Add weapon-specific fields
      if (formData.itemType === 'weapon') {
        itemData.weaponType = formData.weaponType;
        itemData.weaponCategory = formData.weaponCategory;
        itemData.damage = formData.damage;
        itemData.damageType = formData.damageType;
        itemData.properties = formData.properties;
      }

      // Add armor-specific fields
      if (formData.itemType === 'armor' || formData.itemType === 'shield') {
        itemData.armorType = formData.armorType;
        itemData.baseAC = formData.baseAC ? parseInt(formData.baseAC) : undefined;
        itemData.acBonus = formData.acBonus ? parseInt(formData.acBonus) : undefined;
        itemData.strengthRequirement = formData.strengthRequirement
          ? parseInt(formData.strengthRequirement)
          : undefined;
        itemData.stealthDisadvantage = formData.stealthDisadvantage;
      }

      // Add charges if applicable
      if (formData.hasCharges) {
        itemData.charges = {
          max: parseInt(formData.chargesMax) || 1,
          recharge: formData.chargesRecharge || 'At dawn',
        };
      }

      await createContentMutation.mutateAsync({
        type: 'item',
        name: formData.name,
        data: itemData,
        tags: formData.tags,
        sourceType: 'manual',
      });

      // Navigate back to homebrew library
      router.push('/homebrew');
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create magic item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isWeapon = formData.itemType === 'weapon';
  const isArmor = formData.itemType === 'armor' || formData.itemType === 'shield';

  return (
    <Container size="3" style={{ padding: '2rem 1rem' }}>
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeftIcon />
            </Button>
            <Heading size="6">Create Magic Item</Heading>
          </Flex>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? 'Creating...' : 'Create Item'}
          </Button>
        </Flex>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <FormSection
            title="Basic Information"
            description="Core details about the magic item"
          >
            <Grid columns="2" gap="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Item Name <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <TextField.Root
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Flametongue Longsword"
                  required
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Item Type <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root
                  value={formData.itemType}
                  onValueChange={(val) => updateField('itemType', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="weapon">Weapon</Select.Item>
                    <Select.Item value="armor">Armor</Select.Item>
                    <Select.Item value="shield">Shield</Select.Item>
                    <Select.Item value="potion">Potion</Select.Item>
                    <Select.Item value="scroll">Scroll</Select.Item>
                    <Select.Item value="ring">Ring</Select.Item>
                    <Select.Item value="wand">Wand</Select.Item>
                    <Select.Item value="rod">Rod</Select.Item>
                    <Select.Item value="staff">Staff</Select.Item>
                    <Select.Item value="wondrous">Wondrous Item</Select.Item>
                    <Select.Item value="other">Other</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Rarity <span style={{ color: 'var(--red-9)' }}>*</span>
                </Text>
                <Select.Root
                  value={formData.rarity}
                  onValueChange={(val) => updateField('rarity', val)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="Common">Common</Select.Item>
                    <Select.Item value="Uncommon">Uncommon</Select.Item>
                    <Select.Item value="Rare">Rare</Select.Item>
                    <Select.Item value="Very Rare">Very Rare</Select.Item>
                    <Select.Item value="Legendary">Legendary</Select.Item>
                    <Select.Item value="Artifact">Artifact</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Flex align="center" gap="2" style={{ height: '100%', paddingTop: '1.75rem' }}>
                  <Switch
                    checked={formData.requiresAttunement}
                    onCheckedChange={(checked) => updateField('requiresAttunement', checked)}
                  />
                  <Text size="2">Requires Attunement</Text>
                </Flex>
              </Box>
            </Grid>

            {formData.requiresAttunement && (
              <Box mt="3">
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Attunement Requirements
                </Text>
                <TextField.Root
                  value={formData.attunementRequirements}
                  onChange={(e) => updateField('attunementRequirements', e.target.value)}
                  placeholder="e.g., by a spellcaster, by a cleric"
                />
              </Box>
            )}

            <Grid columns="2" gap="3" mt="3">
              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Weight (lbs)
                </Text>
                <TextField.Root
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', e.target.value)}
                  placeholder="e.g., 3.5"
                />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Cost
                </Text>
                <TextField.Root
                  value={formData.cost}
                  onChange={(e) => updateField('cost', e.target.value)}
                  placeholder="e.g., 500 gp"
                />
              </Box>
            </Grid>
          </FormSection>

          {/* Weapon-specific fields */}
          {isWeapon && (
            <FormSection title="Weapon Properties" description="Properties specific to weapons">
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Weapon Type
                  </Text>
                  <Select.Root
                    value={formData.weaponType}
                    onValueChange={(val) => updateField('weaponType', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="simple">Simple</Select.Item>
                      <Select.Item value="martial">Martial</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Category
                  </Text>
                  <Select.Root
                    value={formData.weaponCategory}
                    onValueChange={(val) => updateField('weaponCategory', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="melee">Melee</Select.Item>
                      <Select.Item value="ranged">Ranged</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Damage
                  </Text>
                  <TextField.Root
                    value={formData.damage}
                    onChange={(e) => updateField('damage', e.target.value)}
                    placeholder="e.g., 1d8 + 2"
                  />
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
                      <Select.Item value="slashing">Slashing</Select.Item>
                      <Select.Item value="piercing">Piercing</Select.Item>
                      <Select.Item value="bludgeoning">Bludgeoning</Select.Item>
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
            </FormSection>
          )}

          {/* Armor-specific fields */}
          {isArmor && (
            <FormSection title="Armor Properties" description="Properties specific to armor">
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Armor Type
                  </Text>
                  <Select.Root
                    value={formData.armorType}
                    onValueChange={(val) => updateField('armorType', val)}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="light">Light</Select.Item>
                      <Select.Item value="medium">Medium</Select.Item>
                      <Select.Item value="heavy">Heavy</Select.Item>
                      <Select.Item value="shield">Shield</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Base AC
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.baseAC}
                    onChange={(e) => updateField('baseAC', e.target.value)}
                    placeholder="e.g., 14"
                  />
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    AC Bonus
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.acBonus}
                    onChange={(e) => updateField('acBonus', e.target.value)}
                    placeholder="e.g., +1"
                  />
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Strength Requirement
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.strengthRequirement}
                    onChange={(e) => updateField('strengthRequirement', e.target.value)}
                    placeholder="e.g., 15"
                  />
                </Box>
              </Grid>

              <Flex align="center" gap="2" mt="3">
                <Switch
                  checked={formData.stealthDisadvantage}
                  onCheckedChange={(checked) => updateField('stealthDisadvantage', checked)}
                />
                <Text size="2">Imposes Disadvantage on Stealth</Text>
              </Flex>
            </FormSection>
          )}

          {/* Magical Charges */}
          <FormSection title="Magical Charges" description="Does this item have limited charges?">
            <Flex align="center" gap="2" mb="3">
              <Switch
                checked={formData.hasCharges}
                onCheckedChange={(checked) => updateField('hasCharges', checked)}
              />
              <Text size="2">This item has charges</Text>
            </Flex>

            {formData.hasCharges && (
              <Grid columns="2" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Maximum Charges
                  </Text>
                  <TextField.Root
                    type="number"
                    value={formData.chargesMax}
                    onChange={(e) => updateField('chargesMax', e.target.value)}
                    placeholder="e.g., 7"
                  />
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Recharge
                  </Text>
                  <TextField.Root
                    value={formData.chargesRecharge}
                    onChange={(e) => updateField('chargesRecharge', e.target.value)}
                    placeholder="e.g., 1d6 + 1 at dawn"
                  />
                </Box>
              </Grid>
            )}
          </FormSection>

          {/* Description */}
          <FormSection title="Description" description="Full item description and properties">
            <RichTextEditor
              value={formData.description}
              onChange={(val) => updateField('description', val)}
              placeholder="Describe the item's appearance, history, and magical properties..."
              required
              rows={12}
            />
          </FormSection>

          {/* Tags */}
          <FormSection title="Tags" description="Add tags for easier searching and filtering">
            <TagSelector
              value={formData.tags}
              onChange={(val) => updateField('tags', val)}
              suggestions={[
                'weapon',
                'armor',
                'magical',
                'cursed',
                'sentient',
                'legendary',
                'attunement',
                'charges',
                'consumable',
              ]}
            />
          </FormSection>

          {/* Submit Button */}
          <Flex justify="end" gap="3" mt="4">
            <Button variant="soft" onClick={() => router.back()} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Creating...' : 'Create Magic Item'}
            </Button>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}
