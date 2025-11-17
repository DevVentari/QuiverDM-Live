'use client';

import { useState } from 'react';
import { Flex, Heading, Text, Button, Box } from '@radix-ui/themes';
import { Sword, Check } from 'lucide-react';
import { CobaltCookieHelper } from '../CobaltCookieHelper';

interface DNDBeyondStepProps {
  onConfigured: () => void;
  onSkip?: () => void;
}

export function DNDBeyondStep({ onConfigured, onSkip }: DNDBeyondStepProps) {
  const [configured, setConfigured] = useState(false);

  const handleCookieSet = (cookie: string) => {
    setConfigured(true);
    onConfigured();
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  if (configured) {
    return (
      <Flex direction="column" gap="4" align="center">
        <Box
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--green-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={40} style={{ color: 'var(--green-11)' }} />
        </Box>
        <Heading size="6">D&D Beyond Connected!</Heading>
        <Text size="3" color="gray" style={{ textAlign: 'center', maxWidth: '400px' }}>
          Perfect! You can now import characters directly from D&D Beyond. You can add characters
          from your campaign page.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="2" align="center">
        <Sword size={32} className="text-violet-400" />
        <Heading size="6">Connect D&D Beyond</Heading>
        <Text size="3" color="gray" style={{ textAlign: 'center', maxWidth: '450px' }}>
          Import your characters directly from D&D Beyond to your campaign. This step is optional
          but highly recommended.
        </Text>
      </Flex>

      {/* What is CobaltSession? */}
      <Box
        p="4"
        style={{
          backgroundColor: 'var(--violet-3)',
          borderRadius: '8px',
          border: '1px solid var(--violet-6)',
        }}
      >
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            What is a CobaltSession Cookie?
          </Text>
          <Text size="2" color="gray">
            The CobaltSession cookie is your authentication token for D&D Beyond. It allows
            QuiverDM to securely access your character data on your behalf.
          </Text>
          <Text size="2" color="gray">
            Don&apos;t worry - we&apos;ll guide you through finding it step by step below.
          </Text>
        </Flex>
      </Box>

      {/* Cookie Helper */}
      <CobaltCookieHelper onCookieSet={handleCookieSet} />

      {/* Skip Option */}
      <Box
        p="3"
        style={{
          backgroundColor: 'var(--gray-3)',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <Flex direction="column" gap="2" align="center">
          <Text size="2" color="gray">
            Not ready to set this up right now?
          </Text>
          <Button variant="ghost" size="2" onClick={handleSkip}>
            Skip for now - I&apos;ll set this up later
          </Button>
          <Text size="1" color="gray">
            You can always configure this from Settings
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
}
