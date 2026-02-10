'use client';

import { use, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  TextArea,
  Tabs,
  Grid,
  IconButton,
} from '@radix-ui/themes';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';

interface PlayerEditPageProps {
  params: Promise<{ campaignId: string; playerId: string }>;
}

export default function PlayerEditPage({ params }: PlayerEditPageProps) {
  const { campaignId, playerId } = use(params);
  const router = useRouter();

  const { data: player, isLoading } = trpc.players.getById.useQuery({
    id: playerId,
  });

  const updateMutation = trpc.players.update.useMutation({
    onSuccess: () => {
      router.push(`/campaigns/${campaignId}/players/${playerId}`);
    },
  });

  const [formData, setFormData] = useState<any>(null);

  // Initialize form data when player loads
  if (player && !formData) {
    const characterData = (player.characterData as any) || {};
    setFormData({
      characterName: player.characterName || '',
      name: player.name || '',
      characterRace: player.characterRace || '',
      characterClass: player.characterClass || '',
      level: player.level || 1,
      background: characterData.background || '',
      imageUrl: player.imageUrl || '',
      backstory: player.backstory || '',
      abilityScores: characterData.abilityScores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: characterData.proficiencyBonus || 2,
      armorClass: characterData.armorClass || 10,
      hitPoints: characterData.hitPoints || { current: 0, max: 0, temp: 0 },
      speed: characterData.speed || '30 ft.',
      skills: Array.isArray(characterData.skills) ? characterData.skills : [],
      proficiencies: Array.isArray(characterData.proficiencies) ? characterData.proficiencies : [],
      features: Array.isArray(characterData.features) ? characterData.features : [],
      feats: Array.isArray(characterData.feats) ? characterData.feats : [],
      equipment: Array.isArray(characterData.equipment) ? characterData.equipment : [],
      spells: Array.isArray(characterData.spells) ? characterData.spells : [],
      spellSlots: characterData.spellSlots || {},
    });
  }

  if (isLoading || !formData) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading...</Text>
      </Container>
    );
  }

  const handleSave = () => {
    const { characterName, name, characterRace, characterClass, level, imageUrl, backstory, ...characterData } = formData;

    updateMutation.mutate({
      id: playerId,
      characterName,
      name,
      characterRace,
      characterClass,
      level,
      imageUrl: imageUrl || undefined,
      backstory: backstory || undefined,
      characterData,
    });
  };

  const addItem = (field: string, template: any) => {
    setFormData({
      ...formData,
      [field]: [...formData[field], template],
    });
  };

  const removeItem = (field: string, index: number) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((_: any, i: number) => i !== index),
    });
  };

  const updateItem = (field: string, index: number, updates: any) => {
    setFormData({
      ...formData,
      [field]: formData[field].map((item: any, i: number) =>
        i === index ? { ...item, ...updates } : item
      ),
    });
  };

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Button
            variant="ghost"
            size="2"
            onClick={() => router.push(`/campaigns/${campaignId}/players/${playerId}`)}
          >
            <ArrowLeft size={16} />
            Cancel
          </Button>
          <Heading size="8">Edit Character</Heading>
          <Button size="3" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save size={16} />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </Flex>

        <Tabs.Root defaultValue="basic">
          <Tabs.List>
            <Tabs.Trigger value="basic">Basic Info</Tabs.Trigger>
            <Tabs.Trigger value="stats">Stats</Tabs.Trigger>
            <Tabs.Trigger value="abilities">Abilities</Tabs.Trigger>
            <Tabs.Trigger value="features">Features</Tabs.Trigger>
            <Tabs.Trigger value="spells">Spells</Tabs.Trigger>
            <Tabs.Trigger value="equipment">Equipment</Tabs.Trigger>
          </Tabs.List>

          {/* Basic Info Tab */}
          <Tabs.Content value="basic">
            <Card>
              <Flex direction="column" gap="4" p="4">
                <Heading size="5">Basic Information</Heading>

                <Grid columns={{ initial: '1', sm: '2' }} gap="4">
                  <Box>
                    <Text size="2" weight="bold" mb="1">Character Name</Text>
                    <TextField.Root
                      value={formData.characterName}
                      onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                      placeholder="Character name"
                    />
                  </Box>

                  <Box>
                    <Text size="2" weight="bold" mb="1">Player Name</Text>
                    <TextField.Root
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Player name"
                    />
                  </Box>

                  <Box>
                    <Text size="2" weight="bold" mb="1">Race</Text>
                    <TextField.Root
                      value={formData.characterRace}
                      onChange={(e) => setFormData({ ...formData, characterRace: e.target.value })}
                      placeholder="e.g., Human, Elf, Dwarf"
                    />
                  </Box>

                  <Box>
                    <Text size="2" weight="bold" mb="1">Class</Text>
                    <TextField.Root
                      value={formData.characterClass}
                      onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })}
                      placeholder="e.g., Fighter, Wizard"
                    />
                  </Box>

                  <Box>
                    <Text size="2" weight="bold" mb="1">Level</Text>
                    <TextField.Root
                      type="number"
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                      min="1"
                      max="20"
                    />
                  </Box>

                  <Box>
                    <Text size="2" weight="bold" mb="1">Background</Text>
                    <TextField.Root
                      value={formData.background}
                      onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                      placeholder="e.g., Soldier, Sage"
                    />
                  </Box>
                </Grid>

                <Box>
                  <Text size="2" weight="bold" mb="1">Avatar URL</Text>
                  <TextField.Root
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </Box>

                <Box>
                  <Text size="2" weight="bold" mb="1">Backstory</Text>
                  <TextArea
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    placeholder="Character backstory..."
                    rows={6}
                  />
                </Box>
              </Flex>
            </Card>
          </Tabs.Content>

          {/* Stats Tab */}
          <Tabs.Content value="stats">
            <Flex direction="column" gap="4">
              {/* Ability Scores */}
              <Card>
                <Flex direction="column" gap="4" p="4">
                  <Heading size="5">Ability Scores</Heading>
                  <Grid columns={{ initial: '3', sm: '6' }} gap="3">
                    {[
                      { key: 'str', label: 'STR' },
                      { key: 'dex', label: 'DEX' },
                      { key: 'con', label: 'CON' },
                      { key: 'int', label: 'INT' },
                      { key: 'wis', label: 'WIS' },
                      { key: 'cha', label: 'CHA' },
                    ].map(({ key, label }) => (
                      <Box key={key}>
                        <Text size="1" weight="bold" mb="1">{label}</Text>
                        <TextField.Root
                          type="number"
                          value={formData.abilityScores[key]}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              abilityScores: {
                                ...formData.abilityScores,
                                [key]: parseInt(e.target.value) || 10,
                              },
                            })
                          }
                          min="1"
                          max="30"
                        />
                      </Box>
                    ))}
                  </Grid>
                </Flex>
              </Card>

              {/* Combat Stats */}
              <Card>
                <Flex direction="column" gap="4" p="4">
                  <Heading size="5">Combat Stats</Heading>
                  <Grid columns={{ initial: '2', sm: '4' }} gap="3">
                    <Box>
                      <Text size="2" weight="bold" mb="1">Armor Class</Text>
                      <TextField.Root
                        type="number"
                        value={formData.armorClass}
                        onChange={(e) => setFormData({ ...formData, armorClass: parseInt(e.target.value) || 10 })}
                      />
                    </Box>

                    <Box>
                      <Text size="2" weight="bold" mb="1">Max HP</Text>
                      <TextField.Root
                        type="number"
                        value={formData.hitPoints.max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            hitPoints: { ...formData.hitPoints, max: parseInt(e.target.value) || 0 },
                          })
                        }
                      />
                    </Box>

                    <Box>
                      <Text size="2" weight="bold" mb="1">Speed</Text>
                      <TextField.Root
                        value={formData.speed}
                        onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                        placeholder="30 ft."
                      />
                    </Box>

                    <Box>
                      <Text size="2" weight="bold" mb="1">Proficiency Bonus</Text>
                      <TextField.Root
                        type="number"
                        value={formData.proficiencyBonus}
                        onChange={(e) => setFormData({ ...formData, proficiencyBonus: parseInt(e.target.value) || 2 })}
                      />
                    </Box>
                  </Grid>
                </Flex>
              </Card>
            </Flex>
          </Tabs.Content>

          {/* Abilities Tab */}
          <Tabs.Content value="abilities">
            <Flex direction="column" gap="4">
              {/* Skills */}
              <Card>
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Heading size="5">Skills</Heading>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => addItem('skills', { name: '', modifier: '+0' })}
                    >
                      <Plus size={16} />
                      Add Skill
                    </Button>
                  </Flex>

                  {formData.skills.map((skill: any, index: number) => (
                    <Flex key={index} gap="2" align="end">
                      <Box style={{ flex: 1 }}>
                        <TextField.Root
                          value={skill.name}
                          onChange={(e) => updateItem('skills', index, { name: e.target.value })}
                          placeholder="Skill name"
                        />
                      </Box>
                      <Box style={{ width: '100px' }}>
                        <TextField.Root
                          value={skill.modifier}
                          onChange={(e) => updateItem('skills', index, { modifier: e.target.value })}
                          placeholder="+0"
                        />
                      </Box>
                      <IconButton
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => removeItem('skills', index)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Flex>
                  ))}
                </Flex>
              </Card>

              {/* Proficiencies */}
              <Card>
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Heading size="5">Proficiencies</Heading>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => addItem('proficiencies', '')}
                    >
                      <Plus size={16} />
                      Add Proficiency
                    </Button>
                  </Flex>

                  {formData.proficiencies.map((prof: string, index: number) => (
                    <Flex key={index} gap="2" align="center">
                      <Box style={{ flex: 1 }}>
                        <TextField.Root
                          value={prof}
                          onChange={(e) => {
                            const newProfs = [...formData.proficiencies];
                            newProfs[index] = e.target.value;
                            setFormData({ ...formData, proficiencies: newProfs });
                          }}
                          placeholder="Proficiency name"
                        />
                      </Box>
                      <IconButton
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => removeItem('proficiencies', index)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Flex>
                  ))}
                </Flex>
              </Card>
            </Flex>
          </Tabs.Content>

          {/* Features Tab */}
          <Tabs.Content value="features">
            <Flex direction="column" gap="4">
              {/* Features */}
              <Card>
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Heading size="5">Features & Traits</Heading>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => addItem('features', { name: '', description: '' })}
                    >
                      <Plus size={16} />
                      Add Feature
                    </Button>
                  </Flex>

                  {formData.features.map((feature: any, index: number) => (
                    <Card key={index}>
                      <Flex direction="column" gap="2" p="3">
                        <Flex justify="between" align="center">
                          <TextField.Root
                            value={feature.name}
                            onChange={(e) => updateItem('features', index, { name: e.target.value })}
                            placeholder="Feature name"
                            style={{ flex: 1 }}
                          />
                          <IconButton
                            size="2"
                            variant="soft"
                            color="red"
                            onClick={() => removeItem('features', index)}
                            ml="2"
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Flex>
                        <TextArea
                          value={feature.description}
                          onChange={(e) => updateItem('features', index, { description: e.target.value })}
                          placeholder="Feature description..."
                          rows={3}
                        />
                      </Flex>
                    </Card>
                  ))}
                </Flex>
              </Card>

              {/* Feats */}
              <Card>
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Heading size="5">Feats</Heading>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => addItem('feats', { name: '', description: '' })}
                    >
                      <Plus size={16} />
                      Add Feat
                    </Button>
                  </Flex>

                  {formData.feats.map((feat: any, index: number) => (
                    <Card key={index}>
                      <Flex direction="column" gap="2" p="3">
                        <Flex justify="between" align="center">
                          <TextField.Root
                            value={feat.name}
                            onChange={(e) => updateItem('feats', index, { name: e.target.value })}
                            placeholder="Feat name"
                            style={{ flex: 1 }}
                          />
                          <IconButton
                            size="2"
                            variant="soft"
                            color="red"
                            onClick={() => removeItem('feats', index)}
                            ml="2"
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Flex>
                        <TextArea
                          value={feat.description}
                          onChange={(e) => updateItem('feats', index, { description: e.target.value })}
                          placeholder="Feat description..."
                          rows={3}
                        />
                      </Flex>
                    </Card>
                  ))}
                </Flex>
              </Card>
            </Flex>
          </Tabs.Content>

          {/* Spells Tab */}
          <Tabs.Content value="spells">
            <Card>
              <Flex direction="column" gap="3" p="4">
                <Flex justify="between" align="center">
                  <Heading size="5">Spells</Heading>
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => addItem('spells', { name: '', level: '0', school: '' })}
                  >
                    <Plus size={16} />
                    Add Spell
                  </Button>
                </Flex>

                {formData.spells.map((spell: any, index: number) => (
                  <Flex key={index} gap="2" align="end">
                    <Box style={{ flex: 1 }}>
                      <TextField.Root
                        value={spell.name}
                        onChange={(e) => updateItem('spells', index, { name: e.target.value })}
                        placeholder="Spell name"
                      />
                    </Box>
                    <Box style={{ width: '80px' }}>
                      <TextField.Root
                        value={spell.level}
                        onChange={(e) => updateItem('spells', index, { level: e.target.value })}
                        placeholder="Level"
                      />
                    </Box>
                    <Box style={{ width: '120px' }}>
                      <TextField.Root
                        value={spell.school}
                        onChange={(e) => updateItem('spells', index, { school: e.target.value })}
                        placeholder="School"
                      />
                    </Box>
                    <IconButton
                      size="2"
                      variant="soft"
                      color="red"
                      onClick={() => removeItem('spells', index)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Tabs.Content>

          {/* Equipment Tab */}
          <Tabs.Content value="equipment">
            <Card>
              <Flex direction="column" gap="3" p="4">
                <Flex justify="between" align="center">
                  <Heading size="5">Equipment</Heading>
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => addItem('equipment', { name: '', quantity: 1 })}
                  >
                    <Plus size={16} />
                    Add Item
                  </Button>
                </Flex>

                {formData.equipment.map((item: any, index: number) => (
                  <Flex key={index} gap="2" align="end">
                    <Box style={{ flex: 1 }}>
                      <TextField.Root
                        value={item.name}
                        onChange={(e) => updateItem('equipment', index, { name: e.target.value })}
                        placeholder="Item name"
                      />
                    </Box>
                    <Box style={{ width: '80px' }}>
                      <TextField.Root
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem('equipment', index, { quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Qty"
                        min="1"
                      />
                    </Box>
                    <IconButton
                      size="2"
                      variant="soft"
                      color="red"
                      onClick={() => removeItem('equipment', index)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Tabs.Content>
        </Tabs.Root>
      </Flex>
    </Container>
  );
}
