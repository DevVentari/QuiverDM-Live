'use client';

import { Flex, Heading, Text, Box } from '@radix-ui/themes';
import { Zap, BookOpen, Users, Mic } from 'lucide-react';

export function WelcomeStep() {
  return (
    <Flex direction="column" gap="6" align="center">
      <Flex direction="column" gap="3" align="center">
        <div style={{ fontSize: '4rem' }}>🏹</div>
        <Heading size="8">Welcome to QuiverDM!</Heading>
        <Text size="4" color="gray" style={{ textAlign: 'center', maxWidth: '500px' }}>
          Your AI-powered companion for running amazing D&D campaigns
        </Text>
      </Flex>

      <Flex direction="column" gap="4" style={{ width: '100%', maxWidth: '500px' }}>
        <Feature
          icon={<Mic size={24} />}
          title="Session Recording"
          description="Record your sessions and get AI-generated transcripts with speaker detection"
        />
        <Feature
          icon={<BookOpen size={24} />}
          title="Homebrew Library"
          description="Upload PDFs and extract homebrew content with AI assistance"
        />
        <Feature
          icon={<Users size={24} />}
          title="Campaign Management"
          description="Track players, NPCs, sessions, and your campaign timeline"
        />
        <Feature
          icon={<Zap size={24} />}
          title="D&D Beyond Integration"
          description="Import characters directly from D&D Beyond"
        />
      </Flex>

      <Box
        p="4"
        style={{
          backgroundColor: 'var(--violet-3)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <Text size="2" color="gray" style={{ textAlign: 'center' }}>
          <strong>Quick setup:</strong> This will take about 2-3 minutes. You can skip any step
          and come back later.
        </Text>
      </Box>
    </Flex>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Flex
      gap="3"
      p="3"
      style={{
        backgroundColor: 'var(--gray-3)',
        borderRadius: '8px',
        border: '1px solid var(--gray-6)',
      }}
    >
      <Box style={{ color: 'var(--violet-11)', flexShrink: 0 }}>{icon}</Box>
      <Flex direction="column" gap="1">
        <Text size="3" weight="bold">
          {title}
        </Text>
        <Text size="2" color="gray">
          {description}
        </Text>
      </Flex>
    </Flex>
  );
}
