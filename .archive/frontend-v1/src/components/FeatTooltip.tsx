'use client';

import { HoverCard, Box, Flex, Text, Separator } from '@radix-ui/themes';
import { ReactNode } from 'react';
import { formatDndBeyondHtml } from '@/lib/html-formatter';

interface FeatData {
  name: string;
  description?: string;
  prerequisites?: string;
}

interface FeatTooltipProps {
  feat: FeatData;
  children: ReactNode;
}

export default function FeatTooltip({ feat, children }: FeatTooltipProps) {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger>
        <div style={{ cursor: 'help' }}>
          {children}
        </div>
      </HoverCard.Trigger>
      <HoverCard.Content
        side="top"
        style={{
          maxWidth: '450px',
        }}
      >
        <Flex direction="column" gap="2">
          {/* Header */}
          <Text size="4" weight="bold">
            {feat.name}
          </Text>

          {/* Prerequisites */}
          {feat.prerequisites && (
            <>
              <Text size="2" color="amber" weight="medium">
                Prerequisites: {feat.prerequisites}
              </Text>
              <Separator size="4" style={{ margin: '4px 0' }} />
            </>
          )}

          {/* Description */}
          {feat.description && (
            <Box>
              <Text size="2" style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {formatDndBeyondHtml(feat.description).length > 400
                  ? `${formatDndBeyondHtml(feat.description).substring(0, 400)}...`
                  : formatDndBeyondHtml(feat.description)}
              </Text>
            </Box>
          )}
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
