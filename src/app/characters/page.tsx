'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Separator
} from '@radix-ui/themes';
import { Plus, User, Sword, Shield, Heart, Sparkles, ChevronRight } from 'lucide-react';
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

export default function CharactersPage() {
  const router = useRouter();
  const { data: characters, isLoading } = trpc.characters.getMyCharacters.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
        <Container size="4" className="py-8">
          <Flex direction="column" gap="6">
            <div className="animate-pulse">
              <div className="h-10 w-48 bg-gray-800 rounded mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 bg-gray-800 rounded-lg" />
                ))}
              </div>
            </div>
          </Flex>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30">
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
          {/* Header */}
          <Flex justify="between" align="center">
            <div>
              <Heading size="8" className="text-white mb-2">
                My Characters
              </Heading>
              <Text size="3" className="text-gray-400">
                Manage your player characters across all campaigns
              </Text>
            </div>
            <Link href="/characters/new">
              <Button size="3" style={{ backgroundColor: '#8B5CF6' }}>
                <Plus size={20} />
                New Character
              </Button>
            </Link>
          </Flex>

          {/* Characters Grid */}
          {!characters || characters.length === 0 ? (
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700">
              <Flex direction="column" gap="4" align="center" p="8">
                <div className="w-20 h-20 rounded-full bg-purple-900/50 flex items-center justify-center">
                  <User size={40} className="text-purple-400" />
                </div>
                <Heading size="5" className="text-white">No Characters Yet</Heading>
                <Text color="gray" align="center" style={{ maxWidth: '400px' }}>
                  Create your first character to join campaigns and start your adventure!
                </Text>
                <Link href="/characters/new">
                  <Button size="3" style={{ backgroundColor: '#8B5CF6' }}>
                    <Sparkles size={20} />
                    Create Your First Character
                  </Button>
                </Link>
              </Flex>
            </Card>
          ) : (
            <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
              {characters.map((character) => {
                const abilityScores = character.abilityScores as AbilityScores | null;
                const hitPoints = character.hitPoints as HitPoints | null;
                const activeCampaigns = character.campaignCharacters?.filter(
                  (cc) => cc.status === 'ACTIVE'
                ) || [];
                const pendingCampaigns = character.campaignCharacters?.filter(
                  (cc) => cc.status === 'PENDING'
                ) || [];

                return (
                  <Link key={character.id} href={`/characters/${character.id}`}>
                    <Card
                      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-purple-500 transition-all cursor-pointer group h-full"
                    >
                      <Flex direction="column" gap="4" p="5">
                        {/* Character Header */}
                        <Flex gap="4" align="start">
                          <Avatar
                            size="5"
                            src={character.portraitUrl || undefined}
                            fallback={character.name.substring(0, 2).toUpperCase()}
                            radius="medium"
                            style={{
                              backgroundColor: 'var(--violet-9)',
                              border: '2px solid var(--gray-6)'
                            }}
                          />
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Flex align="center" gap="2" mb="1">
                              <Heading size="4" className="text-white group-hover:text-purple-400 transition-colors truncate">
                                {character.name}
                              </Heading>
                              <Badge color="violet" variant="soft" size="1">
                                Lv {character.level}
                              </Badge>
                            </Flex>
                            <Text size="2" className="text-gray-400">
                              {character.race} {character.class}
                              {character.subclass && ` (${character.subclass})`}
                            </Text>
                          </Box>
                          <ChevronRight
                            size={20}
                            className="text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0"
                          />
                        </Flex>

                        <Separator className="bg-gray-700" />

                        {/* Quick Stats */}
                        <Flex gap="4" wrap="wrap">
                          {hitPoints && (
                            <Flex align="center" gap="1">
                              <Heart size={14} className="text-red-400" />
                              <Text size="2" className="text-gray-300">
                                {hitPoints.current}/{hitPoints.max}
                              </Text>
                            </Flex>
                          )}
                          {character.armorClass && (
                            <Flex align="center" gap="1">
                              <Shield size={14} className="text-blue-400" />
                              <Text size="2" className="text-gray-300">
                                AC {character.armorClass}
                              </Text>
                            </Flex>
                          )}
                          {abilityScores && (
                            <Flex align="center" gap="1">
                              <Sword size={14} className="text-orange-400" />
                              <Text size="2" className="text-gray-300">
                                STR {abilityScores.str}
                              </Text>
                            </Flex>
                          )}
                        </Flex>

                        {/* Campaign Status */}
                        <Box>
                          {activeCampaigns.length > 0 && (
                            <Flex gap="2" wrap="wrap" mb="2">
                              {activeCampaigns.map((cc) => (
                                <Badge key={cc.campaign.id} color="green" variant="soft" size="1">
                                  {cc.campaign.name}
                                </Badge>
                              ))}
                            </Flex>
                          )}
                          {pendingCampaigns.length > 0 && (
                            <Flex gap="2" wrap="wrap">
                              {pendingCampaigns.map((cc) => (
                                <Badge key={cc.campaign.id} color="yellow" variant="soft" size="1">
                                  ⏳ {cc.campaign.name}
                                </Badge>
                              ))}
                            </Flex>
                          )}
                          {activeCampaigns.length === 0 && pendingCampaigns.length === 0 && (
                            <Text size="1" className="text-gray-500">
                              Not in any campaigns
                            </Text>
                          )}
                        </Box>
                      </Flex>
                    </Card>
                  </Link>
                );
              })}
            </Grid>
          )}
        </Flex>
      </Container>
    </div>
  );
}
