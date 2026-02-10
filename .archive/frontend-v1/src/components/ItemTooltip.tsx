'use client';

import { HoverCard, Box, Flex, Text, Badge, Separator } from '@radix-ui/themes';
import { ReactNode } from 'react';

interface ItemData {
  name: string;
  type?: string;
  rarity?: string;
  description?: string;
  quantity?: number;
  equipped?: boolean;
  attuned?: boolean;
  requiresAttunement?: boolean;
  weight?: number;
}

interface ItemTooltipProps {
  item: ItemData;
  children: ReactNode;
}

const getRarityColor = (rarity?: string) => {
  switch (rarity?.toLowerCase()) {
    case 'common':
      return 'gray';
    case 'uncommon':
      return 'green';
    case 'rare':
      return 'blue';
    case 'very rare':
      return 'purple';
    case 'legendary':
      return 'orange';
    case 'artifact':
      return 'red';
    default:
      return 'gray';
  }
};

export default function ItemTooltip({ item, children }: ItemTooltipProps) {
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
              {item.name}
            </Text>
            <Flex gap="1" wrap="wrap" justify="end">
              {item.rarity && (
                <Badge color={getRarityColor(item.rarity)} size="1">
                  {item.rarity}
                </Badge>
              )}
              {item.equipped && (
                <Badge color="green" size="1">
                  Equipped
                </Badge>
              )}
              {item.attuned && (
                <Badge color="purple" size="1">
                  Attuned
                </Badge>
              )}
            </Flex>
          </Flex>

          {/* Type and Details */}
          {item.type && (
            <Text size="2" color="gray" weight="medium">
              {item.type}
              {item.requiresAttunement && ' • Requires Attunement'}
            </Text>
          )}

          <Separator size="4" style={{ margin: '4px 0' }} />

          {/* Item Details */}
          <Flex direction="column" gap="1">
            {item.quantity && item.quantity > 1 && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '70px' }}>
                  Quantity:
                </Text>
                <Text size="1">{item.quantity}</Text>
              </Flex>
            )}
            {item.weight && (
              <Flex gap="2">
                <Text size="1" weight="bold" style={{ minWidth: '70px' }}>
                  Weight:
                </Text>
                <Text size="1">{item.weight} lb.</Text>
              </Flex>
            )}
          </Flex>

          {/* Description */}
          {item.description && (
            <>
              <Separator size="4" style={{ margin: '4px 0' }} />
              <Box>
                <Text size="2" style={{ lineHeight: '1.5' }}>
                  {item.description.length > 300
                    ? `${item.description.substring(0, 300)}...`
                    : item.description}
                </Text>
              </Box>
            </>
          )}
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
