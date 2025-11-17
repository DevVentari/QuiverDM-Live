'use client';

import { HoverCard, Box, Flex, Text, Badge, Separator } from '@radix-ui/themes';
import { ReactNode } from 'react';

interface SpellData {
  name: string;
  level?: number | string;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string[] | string;
  duration?: string;
  description?: string;
  concentration?: boolean;
  ritual?: boolean;
}

interface SpellTooltipProps {
  spell: SpellData;
  children: ReactNode;
}

export default function SpellTooltip({ spell, children }: SpellTooltipProps) {
  const level = spell.level?.toString() || '0';
  const levelText = level === '0' || level === 'Cantrip' ? 'Cantrip' : `Level ${level}`;

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
          maxWidth: '400px',
        }}
      >
        <Flex direction="column" gap="2">
          {/* Header */}
          <Flex justify="between" align="start" gap="3">
            <Text size="4" weight="bold" style={{ flex: 1 }}>
              {spell.name}
            </Text>
            <Flex gap="1">
              {spell.concentration && (
                <Badge color="blue" size="1">
                  Concentration
                </Badge>
              )}
              {spell.ritual && (
                <Badge color="purple" size="1">
                  Ritual
                </Badge>
              )}
            </Flex>
          </Flex>

          {/* Level and School */}
          <Text size="2" color="violet" weight="medium">
            {levelText} {spell.school && `• ${spell.school}`}
          </Text>

          <Separator size="4" style={{ margin: '4px 0' }} />

          {/* Spell Details */}
          <Flex direction="column" gap="1">
            {spell.castingTime && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '80px' }}>
                  Casting Time:
                </Text>
                <Text size="1">{spell.castingTime}</Text>
              </Flex>
            )}
            {spell.range && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '80px' }}>
                  Range:
                </Text>
                <Text size="1">{spell.range}</Text>
              </Flex>
            )}
            {spell.components && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '80px' }}>
                  Components:
                </Text>
                <Text size="1">
                  {Array.isArray(spell.components) ? spell.components.join(', ') : spell.components}
                </Text>
              </Flex>
            )}
            {spell.duration && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '80px' }}>
                  Duration:
                </Text>
                <Text size="1">{spell.duration}</Text>
              </Flex>
            )}
          </Flex>

          {/* Description */}
          {spell.description && (
            <>
              <Separator size="4" style={{ margin: '4px 0' }} />
              <Box>
                <Text size="2" style={{ lineHeight: '1.5' }}>
                  {spell.description.length > 300
                    ? `${spell.description.substring(0, 300)}...`
                    : spell.description}
                </Text>
              </Box>
            </>
          )}
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
