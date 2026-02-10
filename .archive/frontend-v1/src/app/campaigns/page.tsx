'use client';

import { useState, useEffect, Fragment } from 'react';
import { trpc } from '@/lib/trpc';
import { Box, Card, Container, Flex, Heading, Text, Button, Grid, Badge } from '@radix-ui/themes';
import { Plus, Users, Scroll, User, Book, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingWizard } from '@/components/Onboarding/OnboardingWizard';

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: campaigns, isLoading } = trpc.campaigns.getAll.useQuery();

  // Check if we should show onboarding
  useEffect(() => {
    const onboardingParam = searchParams?.get('onboarding');
    const isNewUser = campaigns?.length === 0;

    if (onboardingParam === 'true' || (isNewUser && !isLoading)) {
      setShowOnboarding(true);
    }
  }, [campaigns, isLoading, searchParams]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Refresh to load newly created campaign
    router.refresh();
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading campaigns...</Text>
      </Container>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <>
        {showOnboarding && (
          <OnboardingWizard
            open={showOnboarding}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}
        <Container size="4" className="py-8">
          <Flex direction="column" gap="4" align="center">
            <Heading size="8">Welcome to QuiverDM!</Heading>
            <Text size="3" color="gray">
              Create your first campaign to get started
            </Text>
            <Button size="3" onClick={() => setShowOnboarding(true)}>
              <Plus size={20} />
              Create Campaign
            </Button>
          </Flex>
        </Container>
      </>
    );
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard
          open={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Heading size="8">My Campaigns</Heading>
          <Button size="3" onClick={() => router.push('/campaigns/new')}>
            <Plus size={20} />
            New Campaign
          </Button>
        </Flex>

        {/* Campaigns Grid */}
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => router.push(`/campaigns/${campaign.slug}`)}
            >
              <Flex direction="column" gap="4" p="4">
                {/* Campaign Banner/Header */}
                {campaign.bannerUrl ? (
                  <Box
                    style={{
                      height: '120px',
                      backgroundImage: `url(${campaign.bannerUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '6px',
                    }}
                  />
                ) : (
                  <Box
                    style={{
                      height: '120px',
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Heading size="6" style={{ color: 'white' }}>
                      {campaign.name.charAt(0)}
                    </Heading>
                  </Box>
                )}

                {/* Campaign Info */}
                <Flex direction="column" gap="2">
                  <Flex justify="between" align="start">
                    <Heading size="5">{campaign.name}</Heading>
                    <Badge color={campaign.status === 'active' ? 'green' : 'gray'}>
                      {campaign.status}
                    </Badge>
                  </Flex>

                  {campaign.description && (
                    <Text
                      size="2"
                      color="gray"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {campaign.description}
                    </Text>
                  )}
                </Flex>

                {/* Stats Grid */}
                <Grid columns="4" gap="2">
                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="2"
                    style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                  >
                    <Scroll size={16} className="text-violet-400" />
                    <Text size="3" weight="bold">
                      {campaign._count?.gameSessions ?? 0}
                    </Text>
                    <Text size="1" color="gray">
                      Sessions
                    </Text>
                  </Flex>

                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="2"
                    style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                  >
                    <Users size={16} className="text-emerald-400" />
                    <Text size="3" weight="bold">
                      {campaign._count?.players ?? 0}
                    </Text>
                    <Text size="1" color="gray">
                      Players
                    </Text>
                  </Flex>

                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="2"
                    style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                  >
                    <User size={16} className="text-violet-400" />
                    <Text size="3" weight="bold">
                      {campaign._count?.npcs ?? 0}
                    </Text>
                    <Text size="1" color="gray">
                      NPCs
                    </Text>
                  </Flex>

                  <Flex
                    direction="column"
                    align="center"
                    gap="1"
                    p="2"
                    style={{ background: 'var(--gray-3)', borderRadius: '6px' }}
                  >
                    <Book size={16} className="text-amber-400" />
                    <Text size="3" weight="bold">
                      {0}
                    </Text>
                    <Text size="1" color="gray">
                      Homebrew
                    </Text>
                  </Flex>
                </Grid>

                {/* Action Button */}
                <Flex justify="between" align="center" pt="2" style={{ borderTop: '1px solid var(--gray-6)' }}>
                  <Text size="1" color="gray">
                    Updated {new Date(campaign.updatedAt).toLocaleDateString()}
                  </Text>
                  <Flex align="center" gap="1" style={{ color: 'var(--violet-11)' }}>
                    <Text size="2" weight="medium">
                      Open
                    </Text>
                    <ArrowRight size={14} />
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
    </>
  );
}
