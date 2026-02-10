'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Heading,
  Text,
  Card,
  Flex,
  Button,
  Badge,
  Grid,
  Avatar,
  Box,
  Separator,
  TextArea,
  Dialog
} from '@radix-ui/themes';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Heart,
  Shield,
  Sword,
  Zap,
  Brain,
  Eye,
  Smile,
  Footprints,
  Star,
  Scroll,
  Backpack,
  Coins,
  BookOpen,
  Users
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

interface HitPoints {
  current: number;
  max: number;
  temp?: number;
}

interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

const ABILITY_ICONS: Record<string, React.ReactNode> = {
  str: <Sword size={16} className="text-red-400" />,
  dex: <Zap size={16} className="text-yellow-400" />,
  con: <Heart size={16} className="text-pink-400" />,
  int: <Brain size={16} className="text-blue-400" />,
  wis: <Eye size={16} className="text-purple-400" />,
  cha: <Smile size={16} className="text-orange-400" />,
};

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const characterId = params.characterId as string;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: character, isLoading } = trpc.characters.getById.useQuery({ id: characterId });
  const deleteMutation = trpc.characters.delete.useMutation();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: characterId });
      router.push('/characters');
    } catch (error) {
      console.error('Failed to delete character:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
        <Container size="4" className="py-8">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-800 rounded mb-8" />
            <div className="h-64 bg-gray-800 rounded-lg" />
          </div>
        </Container>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
        <Container size="4" className="py-8">
          <Card className="bg-gray-800/50 border border-gray-700">
            <Flex direction="column" align="center" gap="4" p="8">
              <Heading size="5" className="text-white">Character Not Found</Heading>
              <Link href="/characters">
                <Button variant="soft">Back to Characters</Button>
              </Link>
            </Flex>
          </Card>
        </Container>
      </div>
    );
  }

  const abilityScores = character.abilityScores as AbilityScores | null;
  const hitPoints = character.hitPoints as HitPoints | null;
  const currency = character.currency as Currency | null;
  const features = character.features as string[] | null;
  const proficiencies = character.proficiencies as Record<string, string[]> | null;
  const inventory = character.inventory as Array<{ name: string; quantity?: number }> | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
          {/* Back Button */}
          <Link href="/characters">
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft size={20} />
              Back to Characters
            </Button>
          </Link>

          {/* Character Header Card */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 overflow-hidden">
            {/* Header Banner */}
            <div
              className="h-32 relative"
              style={{
                background: 'linear-gradient(135deg, var(--violet-9) 0%, var(--purple-9) 50%, var(--pink-9) 100%)',
              }}
            >
              <div className="absolute inset-0 bg-black/20" />
            </div>

            <Flex direction="column" p="6" style={{ marginTop: '-60px' }}>
              <Flex gap="5" align="end" mb="4">
                <Avatar
                  size="8"
                  src={character.portraitUrl || undefined}
                  fallback={character.name.substring(0, 2).toUpperCase()}
                  radius="large"
                  style={{
                    backgroundColor: 'var(--gray-8)',
                    border: '4px solid var(--gray-8)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  }}
                />
                <Box style={{ flex: 1 }}>
                  <Flex align="center" gap="3" mb="1">
                    <Heading size="7" className="text-white">
                      {character.name}
                    </Heading>
                    <Badge color="violet" variant="solid" size="2">
                      Level {character.level}
                    </Badge>
                    {character.isPortable && (
                      <Badge color="green" variant="soft" size="1">
                        Portable
                      </Badge>
                    )}
                  </Flex>
                  <Text size="4" className="text-gray-300">
                    {character.race} {character.class}
                    {character.subclass && ` • ${character.subclass}`}
                    {character.background && ` • ${character.background}`}
                  </Text>
                </Box>
                <Flex gap="2">
                  <Link href={`/characters/${characterId}/edit`}>
                    <Button variant="soft" size="2">
                      <Edit size={16} />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="soft"
                    color="red"
                    size="2"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </Flex>
              </Flex>

              {/* Quick Stats Bar */}
              <Flex gap="6" wrap="wrap" className="pt-4">
                {hitPoints && (
                  <Flex align="center" gap="2">
                    <Heart size={20} className="text-red-400" />
                    <div>
                      <Text size="1" className="text-gray-500 block">Hit Points</Text>
                      <Text size="3" weight="bold" className="text-white">
                        {hitPoints.current}/{hitPoints.max}
                        {hitPoints.temp ? ` (+${hitPoints.temp})` : ''}
                      </Text>
                    </div>
                  </Flex>
                )}
                {character.armorClass && (
                  <Flex align="center" gap="2">
                    <Shield size={20} className="text-blue-400" />
                    <div>
                      <Text size="1" className="text-gray-500 block">Armor Class</Text>
                      <Text size="3" weight="bold" className="text-white">{character.armorClass}</Text>
                    </div>
                  </Flex>
                )}
                {character.speed && (
                  <Flex align="center" gap="2">
                    <Footprints size={20} className="text-green-400" />
                    <div>
                      <Text size="1" className="text-gray-500 block">Speed</Text>
                      <Text size="3" weight="bold" className="text-white">{character.speed} ft</Text>
                    </div>
                  </Flex>
                )}
                {character.proficiencyBonus && (
                  <Flex align="center" gap="2">
                    <Star size={20} className="text-yellow-400" />
                    <div>
                      <Text size="1" className="text-gray-500 block">Proficiency</Text>
                      <Text size="3" weight="bold" className="text-white">+{character.proficiencyBonus}</Text>
                    </div>
                  </Flex>
                )}
              </Flex>
            </Flex>
          </Card>

          {/* Main Content Grid */}
          <Grid columns={{ initial: '1', lg: '3' }} gap="6">
            {/* Left Column - Ability Scores */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="4" p="5">
                <Heading size="4" className="text-white">Ability Scores</Heading>
                <Separator className="bg-gray-700" />
                {abilityScores ? (
                  <Grid columns="2" gap="3">
                    {Object.entries(abilityScores).map(([key, value]) => (
                      <Card key={key} className="bg-gray-900/50 border border-gray-700">
                        <Flex direction="column" align="center" p="3">
                          <Flex align="center" gap="2" mb="1">
                            {ABILITY_ICONS[key]}
                            <Text size="1" className="text-gray-400 uppercase">
                              {key}
                            </Text>
                          </Flex>
                          <Text size="6" weight="bold" className="text-white">
                            {value}
                          </Text>
                          <Badge
                            color={Math.floor((value - 10) / 2) >= 0 ? 'green' : 'red'}
                            variant="soft"
                            size="1"
                          >
                            {getModifier(value)}
                          </Badge>
                        </Flex>
                      </Card>
                    ))}
                  </Grid>
                ) : (
                  <Text className="text-gray-500 text-center py-4">No ability scores set</Text>
                )}
              </Flex>
            </Card>

            {/* Middle Column - Features & Proficiencies */}
            <Flex direction="column" gap="6">
              {/* Features */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" gap="2">
                    <Scroll size={20} className="text-purple-400" />
                    <Heading size="4" className="text-white">Features & Traits</Heading>
                  </Flex>
                  <Separator className="bg-gray-700" />
                  {features && features.length > 0 ? (
                    <Flex direction="column" gap="2">
                      {features.map((feature, i) => (
                        <Badge key={i} color="violet" variant="soft" size="2">
                          {feature}
                        </Badge>
                      ))}
                    </Flex>
                  ) : (
                    <Text className="text-gray-500">No features added</Text>
                  )}
                </Flex>
              </Card>

              {/* Proficiencies */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
                <Flex direction="column" gap="4" p="5">
                  <Heading size="4" className="text-white">Proficiencies</Heading>
                  <Separator className="bg-gray-700" />
                  {proficiencies ? (
                    <Flex direction="column" gap="3">
                      {Object.entries(proficiencies).map(([category, items]) => (
                        <Box key={category}>
                          <Text size="2" weight="bold" className="text-gray-400 mb-1 block capitalize">
                            {category}
                          </Text>
                          <Flex gap="2" wrap="wrap">
                            {items.map((item, i) => (
                              <Badge key={i} variant="outline" size="1">
                                {item}
                              </Badge>
                            ))}
                          </Flex>
                        </Box>
                      ))}
                    </Flex>
                  ) : (
                    <Text className="text-gray-500">No proficiencies set</Text>
                  )}
                </Flex>
              </Card>
            </Flex>

            {/* Right Column - Inventory & Currency */}
            <Flex direction="column" gap="6">
              {/* Currency */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" gap="2">
                    <Coins size={20} className="text-yellow-400" />
                    <Heading size="4" className="text-white">Currency</Heading>
                  </Flex>
                  <Separator className="bg-gray-700" />
                  {currency ? (
                    <Grid columns="5" gap="2">
                      {[
                        { key: 'pp', label: 'PP', color: 'text-gray-300' },
                        { key: 'gp', label: 'GP', color: 'text-yellow-400' },
                        { key: 'ep', label: 'EP', color: 'text-blue-300' },
                        { key: 'sp', label: 'SP', color: 'text-gray-400' },
                        { key: 'cp', label: 'CP', color: 'text-orange-600' },
                      ].map(({ key, label, color }) => (
                        <Flex key={key} direction="column" align="center">
                          <Text size="1" className={`${color} font-bold`}>{label}</Text>
                          <Text size="2" className="text-white">
                            {currency[key as keyof Currency]}
                          </Text>
                        </Flex>
                      ))}
                    </Grid>
                  ) : (
                    <Text className="text-gray-500 text-center">No currency set</Text>
                  )}
                </Flex>
              </Card>

              {/* Inventory */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" gap="2">
                    <Backpack size={20} className="text-amber-400" />
                    <Heading size="4" className="text-white">Inventory</Heading>
                  </Flex>
                  <Separator className="bg-gray-700" />
                  {inventory && inventory.length > 0 ? (
                    <Flex direction="column" gap="2">
                      {inventory.map((item, i) => (
                        <Flex key={i} justify="between" align="center" className="text-gray-300">
                          <Text size="2">{item.name}</Text>
                          {item.quantity && item.quantity > 1 && (
                            <Badge variant="soft" size="1">x{item.quantity}</Badge>
                          )}
                        </Flex>
                      ))}
                    </Flex>
                  ) : (
                    <Text className="text-gray-500">No items in inventory</Text>
                  )}
                </Flex>
              </Card>

              {/* Campaigns */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" gap="2">
                    <Users size={20} className="text-green-400" />
                    <Heading size="4" className="text-white">Campaigns</Heading>
                  </Flex>
                  <Separator className="bg-gray-700" />
                  {character.campaignCharacters && character.campaignCharacters.length > 0 ? (
                    <Flex direction="column" gap="2">
                      {character.campaignCharacters.map((cc) => (
                        <Flex key={cc.campaign.id} justify="between" align="center">
                          <Link href={`/campaigns/${cc.campaign.slug}`}>
                            <Text
                              size="2"
                              className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer"
                            >
                              {cc.campaign.name}
                            </Text>
                          </Link>
                          <Badge
                            color={cc.status === 'ACTIVE' ? 'green' : cc.status === 'PENDING' ? 'yellow' : 'gray'}
                            variant="soft"
                            size="1"
                          >
                            {cc.status}
                          </Badge>
                        </Flex>
                      ))}
                    </Flex>
                  ) : (
                    <Text className="text-gray-500">Not in any campaigns</Text>
                  )}
                </Flex>
              </Card>
            </Flex>
          </Grid>

          {/* Backstory & Personality Section */}
          {(character.backstory || character.personalityTraits || character.ideals || character.bonds || character.flaws) && (
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="4" p="5">
                <Flex align="center" gap="2">
                  <BookOpen size={20} className="text-amber-400" />
                  <Heading size="4" className="text-white">Character Story</Heading>
                </Flex>
                <Separator className="bg-gray-700" />
                <Grid columns={{ initial: '1', md: '2' }} gap="6">
                  {character.backstory && (
                    <Box>
                      <Text size="2" weight="bold" className="text-gray-400 mb-2 block">
                        Backstory
                      </Text>
                      <Text className="text-gray-300 whitespace-pre-wrap">{character.backstory}</Text>
                    </Box>
                  )}
                  <Flex direction="column" gap="4">
                    {character.personalityTraits && (
                      <Box>
                        <Text size="2" weight="bold" className="text-gray-400 mb-1 block">
                          Personality Traits
                        </Text>
                        <Text size="2" className="text-gray-300">{character.personalityTraits}</Text>
                      </Box>
                    )}
                    {character.ideals && (
                      <Box>
                        <Text size="2" weight="bold" className="text-gray-400 mb-1 block">
                          Ideals
                        </Text>
                        <Text size="2" className="text-gray-300">{character.ideals}</Text>
                      </Box>
                    )}
                    {character.bonds && (
                      <Box>
                        <Text size="2" weight="bold" className="text-gray-400 mb-1 block">
                          Bonds
                        </Text>
                        <Text size="2" className="text-gray-300">{character.bonds}</Text>
                      </Box>
                    )}
                    {character.flaws && (
                      <Box>
                        <Text size="2" weight="bold" className="text-gray-400 mb-1 block">
                          Flaws
                        </Text>
                        <Text size="2" className="text-gray-300">{character.flaws}</Text>
                      </Box>
                    )}
                  </Flex>
                </Grid>
              </Flex>
            </Card>
          )}
        </Flex>
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>Delete Character</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Are you sure you want to delete <strong>{character.name}</strong>? This action cannot be undone
            and will remove the character from all campaigns.
          </Dialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              color="red"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Character'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
