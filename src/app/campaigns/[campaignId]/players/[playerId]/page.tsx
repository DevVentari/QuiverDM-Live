'use client';

import { use } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  Grid,
  Avatar,
  Badge,
  Separator,
  Tooltip,
} from '@radix-ui/themes';
import {
  ArrowLeft,
  Shield,
  Heart,
  Zap,
  Sword,
  Book,
  User,
  ExternalLink,
  RefreshCw,
  Edit,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';
import { formatDndBeyondHtml } from '@/lib/html-formatter';
import SpellTooltip from '@/components/SpellTooltip';
import FeatTooltip from '@/components/FeatTooltip';
import ItemTooltip from '@/components/ItemTooltip';

interface PlayerDetailPageProps {
  params: Promise<{ campaignId: string; playerId: string }>;
}

export default function PlayerDetailPage({ params }: PlayerDetailPageProps) {
  const { campaignId, playerId } = use(params);
  const router = useRouter();

  const { data: player, isLoading } = trpc.players.getById.useQuery({
    id: playerId,
  });

  const { data: campaign } = trpc.campaigns.getById.useQuery({
    id: campaignId,
  });

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading character...</Text>
      </Container>
    );
  }

  if (!player) {
    return (
      <Container size="4" className="py-8">
        <Text>Character not found</Text>
      </Container>
    );
  }

  const characterData = player.characterData as any;

  // Handle both old (short) and new (full) ability score names for backwards compatibility
  const rawAbilityScores = characterData?.abilityScores || {};
  const abilityScores: any = {};

  // Map short names to full names if needed
  const abilityMapping: { [key: string]: string } = {
    str: 'strength',
    dex: 'dexterity',
    con: 'constitution',
    int: 'intelligence',
    wis: 'wisdom',
    cha: 'charisma',
  };

  // Normalize to full names
  Object.keys(rawAbilityScores).forEach((key) => {
    const fullName = abilityMapping[key] || key;
    abilityScores[fullName] = rawAbilityScores[key];
  });

  const skills = characterData?.skills || [];
  const features = characterData?.features || [];
  const feats = characterData?.feats || [];
  const equipment = characterData?.equipment || [];
  const proficiencies = characterData?.proficiencies || [];
  const spells = characterData?.spells || [];
  const spellSlots = characterData?.spellSlots || {};
  const background = characterData?.background || player.characterData?.background;
  const savingThrows = characterData?.savingThrows || {};

  // Calculate ability modifiers
  const calculateModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  // Calculate saving throw modifier (ability modifier + proficiency if proficient)
  const calculateSavingThrow = (ability: string) => {
    const score = abilityScores[ability] || 10;
    const baseMod = Math.floor((score - 10) / 2);
    const profBonus = savingThrows[ability]?.proficient
      ? (characterData?.proficiencyBonus ? parseInt(characterData.proficiencyBonus.replace('+', '')) : 0)
      : 0;
    const totalMod = baseMod + profBonus;
    return {
      modifier: totalMod >= 0 ? `+${totalMod}` : `${totalMod}`,
      proficient: savingThrows[ability]?.proficient || false,
    };
  };

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Back Button and Action Buttons */}
        <Flex justify="between" align="center">
          <Button
            variant="ghost"
            size="2"
            onClick={() => router.push(`/campaigns/${campaignId}/players`)}
          >
            <ArrowLeft size={16} />
            Back to Players
          </Button>
          <Flex gap="2">
            {player.dndBeyondUrl && (
              <Button
                size="2"
                variant="soft"
                color="blue"
                onClick={() => window.open(player.dndBeyondUrl!, '_blank')}
              >
                <ExternalLink size={16} />
                View on D&D Beyond
              </Button>
            )}
            <Button
              size="2"
              variant="soft"
              onClick={() => router.push(`/campaigns/${campaignId}/players/${playerId}/edit`)}
            >
              <Edit size={16} />
              Edit Character
            </Button>
          </Flex>
        </Flex>

        {/* Character Header with Combat Stats */}
        <Card>
          <Flex direction="column" gap="4" p="4">
            <Flex gap="4" wrap="wrap">
              {/* Left Side: Portrait and Character Info */}
              <Flex align="center" gap="4" style={{ flex: 1, minWidth: '300px' }}>
                <Avatar
                  size="8"
                  src={player.imageUrl || undefined}
                  fallback={player.characterName?.charAt(0) || 'P'}
                  radius="full"
                />
                <Flex direction="column" gap="2">
                  <Heading size="8">{player.characterName}</Heading>
                  <Text size="4" color="gray">
                    {player.name}
                  </Text>
                  {player.characterRace && player.characterClass && (
                    <Text size="3" weight="medium">
                      {player.characterRace} {player.characterClass}
                    </Text>
                  )}
                  {player.level && (
                    <Badge color="violet" size="3">
                      Level {player.level}
                    </Badge>
                  )}
                  {background && (
                    <Text size="2" color="gray">
                      {background}
                    </Text>
                  )}
                  {player.lastSyncedAt && (
                    <Text size="1" color="gray">
                      Last synced: {new Date(player.lastSyncedAt).toLocaleDateString()}
                    </Text>
                  )}
                </Flex>
              </Flex>

              {/* Right Side: Combat Stats */}
              <Flex direction="column" gap="2" style={{ minWidth: '200px' }}>
                <Grid columns="2" gap="2">
                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="3"
                    style={{ background: 'var(--gray-3)', borderRadius: '8px' }}
                  >
                    <Shield size={24} className="text-violet-400" />
                    <Heading size="5">
                      {characterData?.armorClass || '—'}
                    </Heading>
                    <Text size="1" color="gray">
                      AC
                    </Text>
                  </Flex>
                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="3"
                    style={{ background: 'var(--gray-3)', borderRadius: '8px' }}
                  >
                    <Heart size={24} className="text-red-400" />
                    <Heading size="5">
                      {characterData?.hitPoints?.max || '—'}
                    </Heading>
                    <Text size="1" color="gray">
                      HP
                    </Text>
                  </Flex>
                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="3"
                    style={{ background: 'var(--gray-3)', borderRadius: '8px' }}
                  >
                    <Zap size={24} className="text-yellow-400" />
                    <Heading size="5">{characterData?.speed || '—'}</Heading>
                    <Text size="1" color="gray">
                      Speed
                    </Text>
                  </Flex>
                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="3"
                    style={{ background: 'var(--gray-3)', borderRadius: '8px' }}
                  >
                    <Sword size={24} className="text-emerald-400" />
                    <Heading size="5">
                      {characterData?.proficiencyBonus || '—'}
                    </Heading>
                    <Text size="1" color="gray">
                      Prof
                    </Text>
                  </Flex>
                </Grid>
              </Flex>
            </Flex>
          </Flex>
        </Card>

        {/* Ability Scores */}
        <Card>
          <Flex direction="column" gap="4" p="4">
            <Heading size="5">Ability Scores</Heading>
            <Grid columns={{ initial: '3', sm: '6' }} gap="3">
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(
                (ability) => {
                  const score = abilityScores[ability] || 10;
                  return (
                    <Flex
                      key={ability}
                      direction="column"
                      align="center"
                      gap="1"
                      p="3"
                      style={{ background: 'var(--gray-3)', borderRadius: '8px' }}
                    >
                      <Text size="1" weight="bold" style={{ textTransform: 'uppercase' }}>
                        {ability.slice(0, 3)}
                      </Text>
                      <Heading size="6">{score}</Heading>
                      <Text size="2" color="gray">
                        {calculateModifier(score)}
                      </Text>
                    </Flex>
                  );
                }
              )}
            </Grid>
          </Flex>
        </Card>

        {/* Saving Throws */}
        <Card>
          <Flex direction="column" gap="4" p="4">
            <Heading size="5">Saving Throws</Heading>
            <Grid columns={{ initial: '2', sm: '3', md: '6' }} gap="3">
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(
                (ability) => {
                  const saveData = calculateSavingThrow(ability);
                  return (
                    <Flex
                      key={ability}
                      direction="column"
                      align="center"
                      gap="1"
                      p="3"
                      style={{
                        background: saveData.proficient ? 'var(--violet-3)' : 'var(--gray-3)',
                        borderRadius: '8px',
                        border: saveData.proficient ? '1px solid var(--violet-7)' : 'none',
                      }}
                    >
                      <Text size="1" weight="bold" style={{ textTransform: 'uppercase' }}>
                        {ability.slice(0, 3)}
                      </Text>
                      <Heading size="6">{saveData.modifier}</Heading>
                      {saveData.proficient && (
                        <Text size="1" color="violet" weight="bold">
                          ✓ Prof
                        </Text>
                      )}
                    </Flex>
                  );
                }
              )}
            </Grid>
          </Flex>
        </Card>

        {/* Skills (Ability Checks) */}
        {skills.length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Skills</Heading>
              <Grid columns={{ initial: '1', sm: '2' }} gap="2">
                {skills.map((skill: any, index: number) => (
                  <Flex
                    key={index}
                    justify="between"
                    align="center"
                    p="2"
                    style={{
                      background: skill.expertise
                        ? 'var(--purple-3)'
                        : skill.proficient
                        ? 'var(--violet-3)'
                        : 'var(--gray-3)',
                      borderRadius: '6px',
                      border: skill.expertise
                        ? '1px solid var(--purple-7)'
                        : skill.proficient
                        ? '1px solid var(--violet-7)'
                        : 'none',
                    }}
                  >
                    <Flex gap="2" align="center" style={{ flex: 1 }}>
                      <Text size="2" weight="medium">
                        {skill.name || skill}
                      </Text>
                      <Text size="1" color="gray" style={{ textTransform: 'uppercase' }}>
                        ({(skill.ability || '').slice(0, 3)})
                      </Text>
                    </Flex>
                    <Flex gap="1" align="center">
                      {skill.expertise && (
                        <Badge color="purple" size="1">
                          ★
                        </Badge>
                      )}
                      {skill.proficient && !skill.expertise && (
                        <Badge color="violet" size="1">
                          ✓
                        </Badge>
                      )}
                      <Badge color={skill.proficient || skill.expertise ? 'violet' : 'gray'} size="2">
                        {skill.modifier || (skill.bonus !== undefined ? (skill.bonus >= 0 ? `+${skill.bonus}` : skill.bonus) : '+0')}
                      </Badge>
                    </Flex>
                  </Flex>
                ))}
              </Grid>
            </Flex>
          </Card>
        )}

        <Grid columns={{ initial: '1', md: '2' }} gap="4">

          {/* Proficiencies */}
          {proficiencies.length > 0 && (
            <Card>
              <Flex direction="column" gap="3" p="4">
                <Heading size="5">Proficiencies</Heading>
                <Flex direction="column" gap="2">
                  {proficiencies.map((prof: any, index: number) => (
                    <Flex
                      key={index}
                      align="center"
                      gap="2"
                      p="2"
                      style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                    >
                      <Text size="2">{prof.name || prof}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </Card>
          )}
        </Grid>

        {/* Features & Traits */}
        {features.length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Features & Traits</Heading>
              <Flex direction="column" gap="3">
                {features.map((feature: any, index: number) => (
                  <Box key={index}>
                    <Flex direction="column" gap="2">
                      <Text size="3" weight="bold">
                        {feature.name || feature.title}
                      </Text>
                      {feature.description && (
                        <Text size="2" color="gray" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                          {formatDndBeyondHtml(feature.description)}
                        </Text>
                      )}
                    </Flex>
                    {index < features.length - 1 && <Separator my="3" size="4" />}
                  </Box>
                ))}
              </Flex>
            </Flex>
          </Card>
        )}

        {/* Feats */}
        {feats.length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Feats</Heading>
              <Grid columns={{ initial: '1', sm: '2' }} gap="2">
                {feats.map((feat: any, index: number) => (
                  <FeatTooltip key={index} feat={feat}>
                    <Flex
                      direction="column"
                      gap="1"
                      p="3"
                      style={{
                        background: 'var(--gray-3)',
                        borderRadius: '6px',
                        cursor: 'help',
                        transition: 'background 0.2s',
                      }}
                      className="hover:bg-amber-3"
                    >
                      <Text size="2" weight="bold">
                        {feat.name}
                      </Text>
                      {feat.description && (
                        <Text size="1" color="gray" style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {formatDndBeyondHtml(feat.description)}
                        </Text>
                      )}
                    </Flex>
                  </FeatTooltip>
                ))}
              </Grid>
            </Flex>
          </Card>
        )}

        {/* Spells */}
        {spells.length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Spells</Heading>

              {/* Spell Slots */}
              {Object.keys(spellSlots).length > 0 && (
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold" color="gray">
                    Spell Slots
                  </Text>
                  <Grid columns={{ initial: '3', sm: '6' }} gap="2">
                    {Object.entries(spellSlots).map(([level, slots]: [string, any]) => (
                      <Flex
                        key={level}
                        direction="column"
                        align="center"
                        gap="1"
                        p="2"
                        style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                      >
                        <Text size="1" weight="bold">
                          {level.replace('level', 'Lvl ')}
                        </Text>
                        <Text size="2">
                          {slots.total - slots.used} / {slots.total}
                        </Text>
                      </Flex>
                    ))}
                  </Grid>
                  <Separator my="2" size="4" />
                </Flex>
              )}

              {/* Spell List */}
              <Flex direction="column" gap="2">
                {/* Group spells by level */}
                {['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'].map((levelName, levelNum) => {
                  const levelSpells = spells.filter((spell: any) => {
                    const spellLevel = spell.level?.toString() || '0';
                    return (levelNum === 0 && (spellLevel === '0' || spell.level === 'Cantrip')) ||
                           spellLevel === levelNum.toString();
                  });

                  if (levelSpells.length === 0) return null;

                  return (
                    <Box key={levelName}>
                      <Text size="2" weight="bold" mb="2">
                        {levelName} Level {levelNum > 0 && `(${levelSpells.length})`}
                      </Text>
                      <Grid columns={{ initial: '1', sm: '2' }} gap="2">
                        {levelSpells.map((spell: any, index: number) => (
                          <SpellTooltip key={index} spell={spell}>
                            <Flex
                              align="center"
                              gap="2"
                              p="2"
                              style={{
                                background: 'var(--gray-3)',
                                borderRadius: '6px',
                                cursor: 'help',
                                transition: 'background 0.2s',
                              }}
                              className="hover:bg-violet-3"
                            >
                              <Flex direction="column" style={{ flex: 1 }}>
                                <Text size="2" weight="medium">
                                  {spell.name}
                                </Text>
                                {spell.school && (
                                  <Text size="1" color="gray">
                                    {spell.school}
                                  </Text>
                                )}
                              </Flex>
                            </Flex>
                          </SpellTooltip>
                        ))}
                      </Grid>
                    </Box>
                  );
                })}
              </Flex>
            </Flex>
          </Card>
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Equipment</Heading>
              <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="2">
                {equipment.map((item: any, index: number) => {
                  // Handle both string items and object items
                  const itemData = typeof item === 'string' ? { name: item } : item;

                  return (
                    <ItemTooltip key={index} item={itemData}>
                      <Flex
                        align="center"
                        gap="2"
                        p="2"
                        style={{
                          background: 'var(--gray-3)',
                          borderRadius: '6px',
                          cursor: 'help',
                          transition: 'background 0.2s',
                        }}
                        className="hover:bg-blue-3"
                      >
                        <Flex direction="column" style={{ flex: 1 }}>
                          <Text size="2" weight="medium">
                            {itemData.name}
                            {itemData.quantity > 1 && ` (×${itemData.quantity})`}
                          </Text>
                          {itemData.type && (
                            <Text size="1" color="gray">
                              {itemData.type}
                            </Text>
                          )}
                        </Flex>
                        {itemData.equipped && (
                          <Badge color="green" size="1">
                            E
                          </Badge>
                        )}
                      </Flex>
                    </ItemTooltip>
                  );
                })}
              </Grid>
            </Flex>
          </Card>
        )}

        {/* Backstory */}
        {player.backstory && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Backstory</Heading>
              <Text size="3" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {player.backstory}
              </Text>
            </Flex>
          </Card>
        )}

        {/* Character Data Debug (in case there's additional data not displayed) */}
        {characterData && Object.keys(characterData).length > 0 && (
          <Card>
            <Flex direction="column" gap="3" p="4">
              <Heading size="5">Additional Character Data</Heading>
              <Box
                p="3"
                style={{
                  background: 'var(--gray-3)',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '400px',
                }}
              >
                <pre>{JSON.stringify(characterData, null, 2)}</pre>
              </Box>
            </Flex>
          </Card>
        )}
      </Flex>
    </Container>
  );
}
