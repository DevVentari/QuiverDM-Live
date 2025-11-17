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
} from '@radix-ui/themes';
import {  User, Shield, Heart, Zap, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';
import DndBeyondImport from '@/components/DndBeyondImport';

interface PlayersPageProps {
  params: Promise<{ campaignId: string }>;
}

export default function PlayersPage({ params }: PlayersPageProps) {
  const { campaignId } = use(params);
  const router = useRouter();

  const { data: players, isLoading, refetch } = trpc.players.getAll.useQuery({
    campaignId,
  });

  const { data: campaign } = trpc.campaigns.getById.useQuery({
    id: campaignId,
  });

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading players...</Text>
      </Container>
    );
  }

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Heading size="9">Player Characters</Heading>
          <DndBeyondImport
            campaignId={campaignId}
            onImportComplete={() => refetch()}
          />
        </Flex>

        {/* Players List */}
        {!players || players.length === 0 ? (
          <Card>
            <Flex direction="column" gap="4" align="center" p="6">
              <User size={48} className="text-gray-500" />
              <Heading size="5" color="gray">No Players Yet</Heading>
              <Text size="2" color="gray" align="center">
                Import characters from D&D Beyond to get started
              </Text>
              <DndBeyondImport
                campaignId={campaignId}
                onImportComplete={() => refetch()}
              />
            </Flex>
          </Card>
        ) : (
          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
            {players.map((player) => (
              <Card
                key={player.id}
                className="cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => router.push(`/campaigns/${campaignId}/players/${player.id}`)}
              >
                <Flex direction="column" gap="4" p="4">
                  {/* Avatar and Name */}
                  <Flex align="center" gap="3">
                    <Avatar
                      size="5"
                      src={player.imageUrl || undefined}
                      fallback={player.characterName?.charAt(0) || 'P'}
                      radius="full"
                    />
                    <Flex direction="column" gap="1">
                      <Heading size="4">{player.characterName}</Heading>
                      <Text size="1" color="gray">
                        {player.name}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Class, Race, Level */}
                  <Flex direction="column" gap="2">
                    {player.characterRace && player.characterClass && (
                      <Text size="2" weight="medium">
                        {player.characterRace} {player.characterClass}
                      </Text>
                    )}
                    {player.level && (
                      <Badge color="violet" size="2">
                        Level {player.level}
                      </Badge>
                    )}
                  </Flex>

                  {/* Character Stats (if available) */}
                  {player.characterData && typeof player.characterData === 'object' && (
                    <Grid columns="3" gap="2">
                      {(player.characterData as any).armorClass && (
                        <Flex direction="column" align="center" gap="1" p="2" style={{ background: 'var(--gray-3)', borderRadius: '6px' }}>
                          <Shield size={16} className="text-violet-400" />
                          <Text size="1" weight="bold">{(player.characterData as any).armorClass}</Text>
                          <Text size="1" color="gray">AC</Text>
                        </Flex>
                      )}
                      {(player.characterData as any).hitPoints && (
                        <Flex direction="column" align="center" gap="1" p="2" style={{ background: 'var(--gray-3)', borderRadius: '6px' }}>
                          <Heart size={16} className="text-red-400" />
                          <Text size="1" weight="bold">{(player.characterData as any).hitPoints.max}</Text>
                          <Text size="1" color="gray">HP</Text>
                        </Flex>
                      )}
                      {(player.characterData as any).speed && (
                        <Flex direction="column" align="center" gap="1" p="2" style={{ background: 'var(--gray-3)', borderRadius: '6px' }}>
                          <Zap size={16} className="text-yellow-400" />
                          <Text size="1" weight="bold">{(player.characterData as any).speed}</Text>
                          <Text size="1" color="gray">Speed</Text>
                        </Flex>
                      )}
                    </Grid>
                  )}

                  {/* Backstory Preview */}
                  {player.backstory && (
                    <Text size="2" color="gray" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {player.backstory}
                    </Text>
                  )}

                  {/* D&D Beyond Link */}
                  {player.dndBeyondUrl && (
                    <Flex align="center" justify="between" pt="2" style={{ borderTop: '1px solid var(--gray-6)' }}>
                      <Text size="1" color="gray">
                        Last synced: {player.lastSyncedAt ? new Date(player.lastSyncedAt).toLocaleDateString() : 'Never'}
                      </Text>
                      <Button
                        size="1"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(player.dndBeyondUrl!, '_blank');
                        }}
                      >
                        <ExternalLink size={12} />
                        D&D Beyond
                      </Button>
                    </Flex>
                  )}
                </Flex>
              </Card>
            ))}
          </Grid>
        )}
      </Flex>
    </Container>
  );
}
