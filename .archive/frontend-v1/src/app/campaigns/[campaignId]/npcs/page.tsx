'use client';

import { use, useState } from 'react';
import Image from 'next/image';
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
  Badge,
  Grid,
} from '@radix-ui/themes';
import { Plus, Users, Search, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';

interface NPCsPageProps {
  params: Promise<{ campaignId: string }>;
}

export default function NPCsPage({ params }: NPCsPageProps) {
  const { campaignId } = use(params);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: npcs, isLoading } = trpc.npcs.getAll.useQuery({
    campaignId,
    search: searchQuery || undefined,
  });

  const handleCreateNPC = () => {
    router.push(`/campaigns/${campaignId}/npcs/new`);
  };

  const handleNPCClick = (npcId: string) => {
    router.push(`/campaigns/${campaignId}/npcs/${npcId}`);
  };

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading NPCs...</Text>
      </Container>
    );
  }

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Heading size="8">NPCs</Heading>
          <Button size="3" onClick={handleCreateNPC}>
            <Plus size={20} />
            Add NPC
          </Button>
        </Flex>

        {/* Search */}
        <Card>
          <TextField.Root
            placeholder="Search NPCs by name, description, or faction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="3"
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
        </Card>

        {/* NPC Grid */}
        {!npcs || npcs.length === 0 ? (
          <Card>
            <Flex direction="column" gap="4" align="center" p="8">
              <Users size={64} className="text-gray-600" />
              <Heading size="4">
                {searchQuery ? 'No NPCs Found' : 'No NPCs Yet'}
              </Heading>
              <Text color="gray" align="center">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Add NPCs to track characters, factions, and important figures in your campaign'}
              </Text>
              {!searchQuery && (
                <Button size="3" onClick={handleCreateNPC}>
                  <Plus size={20} />
                  Create First NPC
                </Button>
              )}
            </Flex>
          </Card>
        ) : (
          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
            {npcs.map((npc) => (
              <Card
                key={npc.id}
                className="cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleNPCClick(npc.id)}
              >
                <Flex direction="column" gap="3" p="2">
                  {/* Avatar/Image placeholder */}
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      position: 'relative',
                      height: '120px',
                      backgroundColor: 'var(--gray-5)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    {npc.imageUrl ? (
                      <Image
                        src={npc.imageUrl}
                        alt={npc.name}
                        layout="fill"
                        objectFit="cover"
                      />
                    ) : (
                      <Users size={48} className="text-gray-600" />
                    )}
                  </Flex>

                  {/* NPC Info */}
                  <Flex direction="column" gap="2">
                    <Heading size="4">{npc.name}</Heading>

                    {npc.faction && (
                      <Flex align="center" gap="1">
                        <Shield size={14} className="text-violet-500" />
                        <Badge color="violet" variant="soft" size="1">
                          {npc.faction}
                        </Badge>
                      </Flex>
                    )}

                    {npc.description && (
                      <Text size="2" color="gray" className="line-clamp-2">
                        {npc.description.substring(0, 100)}
                        {npc.description.length > 100 ? '...' : ''}
                      </Text>
                    )}

                    {npc.secrets && (
                      <Flex align="center" gap="1">
                        <Text size="1" color="amber">
                          Has secrets
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Grid>
        )}

        {/* Floating Action Button */}
        <Box
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
          }}
        >
          <Button
            size="4"
            onClick={handleCreateNPC}
            style={{
              borderRadius: '50%',
              width: '64px',
              height: '64px',
              padding: 0,
            }}
          >
            <Plus size={32} />
          </Button>
        </Box>
      </Flex>
    </Container>
  );
}
