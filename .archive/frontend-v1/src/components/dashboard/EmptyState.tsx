'use client';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';

type EmptyStateType = 'new-user' | 'no-characters' | 'no-campaigns';

interface EmptyStateProps {
  type: EmptyStateType;
}

export function EmptyState({ type }: EmptyStateProps) {
  switch (type) {
    case 'new-user':
      return <NewUserEmptyState />;
    case 'no-characters':
      return <NoCharactersEmptyState />;
    case 'no-campaigns':
      return <NoCampaignsEmptyState />;
    default:
      return null;
  }
}

function NewUserEmptyState() {
  return (
    <Card className="bg-gradient-to-br from-cream-light to-cream-white border border-cream-border p-8 text-center">
      <div className="text-6xl mb-4">🏹</div>
      <Heading size="6" className="text-text-primary mb-3 font-display">
        Welcome to QuiverDM
      </Heading>
      <Text className="text-text-secondary mb-8 block font-body">
        Are you here to play or run a game?
      </Text>

      <Flex gap="4" justify="center" wrap="wrap">
        <Link href="/join">
          <Card className="bg-cream-white border border-cream-border hover:border-accent-warm p-6 cursor-pointer transition-all group w-40">
            <div className="text-4xl mb-3">🎭</div>
            <Text className="text-text-primary font-display font-semibold group-hover:text-accent-warm transition-colors block">
              I&apos;m a Player
            </Text>
            <Text className="text-text-secondary text-xs mt-1 block font-body">
              Join a campaign
            </Text>
          </Card>
        </Link>

        <Link href="/campaigns/new">
          <Card className="bg-cream-white border border-cream-border hover:border-accent-warm p-6 cursor-pointer transition-all group w-40">
            <div className="text-4xl mb-3">👑</div>
            <Text className="text-text-primary font-display font-semibold group-hover:text-accent-warm transition-colors block">
              I&apos;m a DM
            </Text>
            <Text className="text-text-secondary text-xs mt-1 block font-body">
              Create a campaign
            </Text>
          </Card>
        </Link>
      </Flex>

      <Text className="text-text-secondary/70 text-sm mt-6 block font-body">
        (You can do both later!)
      </Text>
    </Card>
  );
}

function NoCharactersEmptyState() {
  return (
    <Card className="bg-cream-white/50 border border-dashed border-cream-border p-8 text-center">
      <div className="text-4xl mb-3">🎭</div>
      <Heading size="4" className="text-text-primary mb-2 font-display">
        No characters yet
      </Heading>
      <Text className="text-text-secondary mb-4 block font-body">
        Create your first character to join a campaign
      </Text>
      <Link href="/characters/new">
        <Button size="2" className="bg-accent-warm hover:bg-accent-light text-cream-bg">
          Create Character
        </Button>
      </Link>
    </Card>
  );
}

function NoCampaignsEmptyState() {
  return (
    <Card className="bg-cream-white/50 border border-dashed border-cream-border p-8 text-center">
      <div className="text-4xl mb-3">🏰</div>
      <Heading size="4" className="text-text-primary mb-2 font-display">
        No campaigns yet
      </Heading>
      <Text className="text-text-secondary mb-4 block font-body">
        Join an existing campaign or create your own
      </Text>
      <Flex gap="3" justify="center">
        <Link href="/join">
          <Button size="2" variant="soft" className="text-text-primary">
            Join Campaign
          </Button>
        </Link>
        <Link href="/campaigns/new">
          <Button size="2" className="bg-accent-warm hover:bg-accent-light text-cream-bg">
            Create Campaign
          </Button>
        </Link>
      </Flex>
    </Card>
  );
}
