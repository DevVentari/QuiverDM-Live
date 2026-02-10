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
  Badge,
} from '@radix-ui/themes';
import {
  Users,
  Scroll,
  Book,
  Calendar,
  Play,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';
import DndBeyondImport from '@/components/DndBeyondImport';

interface CampaignOverviewPageProps {
  params: Promise<{ campaignId: string }>;
}

export default function CampaignOverviewPage({ params }: CampaignOverviewPageProps) {
  const { campaignId: campaignIdOrSlug } = use(params);
  const router = useRouter();

  // Detect if we have a slug (contains hyphens and lowercase) or an ID (cuid format)
  const isSlug = campaignIdOrSlug.includes('-') && campaignIdOrSlug === campaignIdOrSlug.toLowerCase();

  // Fetch campaign by slug or ID
  const { data: campaign, isLoading } = isSlug
    ? trpc.campaigns.getBySlug.useQuery({ slug: campaignIdOrSlug })
    : trpc.campaigns.getById.useQuery({ id: campaignIdOrSlug });

  // Extract the actual campaign ID for child queries
  const campaignId = campaign?.id;

  const { data: npcs } = trpc.npcs.getAll.useQuery({
    campaignId: campaignId!,
  }, { enabled: !!campaignId });

  const { data: sessions } = trpc.sessions.getAll.useQuery({
    campaignId: campaignId!,
  }, { enabled: !!campaignId });

  const { data: activeSession } = trpc.sessions.getActive.useQuery({
    campaignId: campaignId!,
  }, { enabled: !!campaignId });

  // const { data: homebrewStats } = trpc.homebrew.getContentStats.useQuery({
  //   campaignId: campaignId!,
  // }, { enabled: !!campaignId });

  const { data: players } = trpc.players.getAll.useQuery({
    campaignId: campaignId!,
  }, { enabled: !!campaignId });

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading campaign...</Text>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container size="4" className="py-8">
        <Text>Campaign not found</Text>
      </Container>
    );
  }

  const recentSessions = sessions?.slice(0, 3) || [];
  const npcCount = npcs?.length || 0;
  const sessionCount = sessions?.length || 0;
  const playerCount = players?.length || 0;
  const homebrewCount = 0; // homebrewStats?.total || 0;

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId!} />

      <Flex direction="column" gap="6">
        {/* Campaign Header */}
        <Flex direction="column" gap="3">
          <Heading size="9">{campaign.name}</Heading>
          {campaign.description && (
            <Text size="3" color="gray" style={{ whiteSpace: 'pre-wrap' }}>
              {campaign.description}
            </Text>
          )}
        </Flex>

        {/* Active Session Banner */}
        {activeSession && (
          <Card style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
            <Flex direction="column" gap="3">
              <Flex align="center" gap="2">
                <Play size={24} />
                <Heading size="5">Session In Progress</Heading>
              </Flex>
              <Text size="4" weight="bold">
                {activeSession.title}
              </Text>
              <Button
                size="2"
                variant="soft"
                style={{ width: 'fit-content' }}
                onClick={() => router.push(`/campaigns/${campaignId}/sessions/${activeSession.id}`)}
              >
                Continue Session
              </Button>
            </Flex>
          </Card>
        )}

        {/* Stats Grid */}
        <Grid columns={{ initial: '1', sm: '4' }} gap="4">
          <Card
            className="cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => router.push(`/campaigns/${campaignId}/players`)}
          >
            <Flex direction="column" gap="3" align="center" p="4">
              <Users size={32} className="text-emerald-500" />
              <Heading size="6">{playerCount}</Heading>
              <Text size="2" color="gray">PLAYERS</Text>
            </Flex>
          </Card>

          <Card
            className="cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => router.push(`/campaigns/${campaignId}/npcs`)}
          >
            <Flex direction="column" gap="3" align="center" p="4">
              <Users size={32} className="text-violet-500" />
              <Heading size="6">{npcCount}</Heading>
              <Text size="2" color="gray">NPCs</Text>
            </Flex>
          </Card>

          <Card
            className="cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => router.push(`/campaigns/${campaignId}/sessions`)}
          >
            <Flex direction="column" gap="3" align="center" p="4">
              <Scroll size={32} className="text-violet-500" />
              <Heading size="6">{sessionCount}</Heading>
              <Text size="2" color="gray">SESSIONS</Text>
            </Flex>
          </Card>

          <Card
            className="cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => router.push(`/campaigns/${campaignId}/homebrew`)}
          >
            <Flex direction="column" gap="3" align="center" p="4">
              <Book size={32} className="text-violet-500" />
              <Heading size="6">{homebrewCount}</Heading>
              <Text size="2" color="gray">HOMEBREW</Text>
            </Flex>
          </Card>
        </Grid>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <Card>
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center">
                <Heading size="5">Recent Sessions</Heading>
                <Button
                  variant="ghost"
                  size="2"
                  onClick={() => router.push(`/campaigns/${campaignId}/sessions`)}
                >
                  View All
                  <ArrowRight size={16} />
                </Button>
              </Flex>

              <Flex direction="column" gap="3">
                {recentSessions.map((session) => (
                  <Box
                    key={session.id}
                    className="cursor-pointer hover:bg-gray-800 transition-colors"
                    p="3"
                    style={{ borderRadius: '8px' }}
                    onClick={() => router.push(`/campaigns/${campaignId}/sessions/${session.id}`)}
                  >
                    <Flex direction="column" gap="2">
                      <Flex align="center" gap="2">
                        <Text size="1" color="gray" weight="medium">
                          SESSION {session.sessionNumber}
                        </Text>
                        {session.status === 'in_progress' && (
                          <Badge color="blue">
                            <Play size={12} />
                            In Progress
                          </Badge>
                        )}
                      </Flex>
                      <Heading size="3">{session.title}</Heading>
                      <Flex align="center" gap="1">
                        <Calendar size={14} className="text-gray-500" />
                        <Text size="1" color="gray">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </Flex>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <Flex direction="column" gap="4">
            <Heading size="5">Quick Actions</Heading>
            <Flex gap="3" wrap="wrap">
              <DndBeyondImport
                campaignId={campaignId!}
                onImportComplete={() => window.location.reload()}
              />
              <Button
                size="3"
                variant="soft"
                onClick={() => router.push(`/campaigns/${campaignId}/npcs/new`)}
              >
                <Users size={16} />
                Add NPC
              </Button>
              <Button
                size="3"
                variant="soft"
                onClick={() => router.push(`/campaigns/${campaignId}/sessions`)}
                disabled={!!activeSession}
              >
                <Scroll size={16} />
                {activeSession ? 'Session In Progress' : 'Start Session'}
              </Button>
              <Button
                size="3"
                variant="soft"
                onClick={() => router.push(`/campaigns/${campaignId}/homebrew`)}
              >
                <Book size={16} />
                Browse Homebrew
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
