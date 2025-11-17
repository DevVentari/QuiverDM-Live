'use client';

import { Flex, Heading, Text, Box, Card } from '@radix-ui/themes';
import { PartyPopper, Mic, BookOpen, Users, Upload } from 'lucide-react';

export function CompleteStep() {
  return (
    <Flex direction="column" gap="6" align="center">
      {/* Success Animation */}
      <Flex direction="column" gap="3" align="center">
        <Box
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: 'var(--violet-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PartyPopper size={50} className="text-violet-400" />
        </Box>
        <Heading size="7">You're All Set!</Heading>
        <Text size="4" color="gray" style={{ textAlign: 'center', maxWidth: '450px' }}>
          Congratulations! Your QuiverDM campaign is ready. Here are some things you can do next:
        </Text>
      </Flex>

      {/* Next Steps Checklist */}
      <Flex direction="column" gap="3" style={{ width: '100%', maxWidth: '500px' }}>
        <NextStepCard
          icon={<Users size={24} />}
          title="Import Characters"
          description="Import your players' characters from D&D Beyond or add them manually"
          color="emerald"
        />
        <NextStepCard
          icon={<Mic size={24} />}
          title="Record Your First Session"
          description="Upload session recordings and get AI-generated transcripts with speaker detection"
          color="violet"
        />
        <NextStepCard
          icon={<BookOpen size={24} />}
          title="Add Homebrew Content"
          description="Upload PDFs and extract homebrew content with AI assistance"
          color="amber"
        />
        <NextStepCard
          icon={<Upload size={24} />}
          title="Track Your Campaign"
          description="Add NPCs, locations, and plot threads as your campaign progresses"
          color="blue"
        />
      </Flex>

      {/* Quick Tips */}
      <Box
        p="4"
        style={{
          backgroundColor: 'var(--violet-3)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold" style={{ color: 'var(--violet-11)' }}>
            💡 Pro Tips
          </Text>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>
              <Text size="2" color="gray">
                Use the session recorder to capture every moment of your games
              </Text>
            </li>
            <li>
              <Text size="2" color="gray">
                Campaign glossary helps improve transcription accuracy for custom names
              </Text>
            </li>
            <li>
              <Text size="2" color="gray">
                Homebrew library can extract content from rulebooks, adventures, and supplements
              </Text>
            </li>
            <li>
              <Text size="2" color="gray">
                All your data stays private and is encrypted at rest
              </Text>
            </li>
          </ul>
        </Flex>
      </Box>

      {/* Call to Action */}
      <Box style={{ textAlign: 'center' }}>
        <Text size="2" color="gray">
          Ready to start your adventure?
        </Text>
      </Box>
    </Flex>
  );
}

function NextStepCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'emerald' | 'violet' | 'amber' | 'blue';
}) {
  const colorMap = {
    emerald: 'var(--emerald-11)',
    violet: 'var(--violet-11)',
    amber: 'var(--amber-11)',
    blue: 'var(--blue-11)',
  };

  return (
    <Card>
      <Flex gap="3" p="3" align="start">
        <Box style={{ color: colorMap[color], flexShrink: 0 }}>{icon}</Box>
        <Flex direction="column" gap="1">
          <Text size="3" weight="bold">
            {title}
          </Text>
          <Text size="2" color="gray">
            {description}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}
