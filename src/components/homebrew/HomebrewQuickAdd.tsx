'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  Button,
  TextField,
  Select,
  Badge,
  Card,
  Text,
} from '@radix-ui/themes';

interface HomebrewQuickAddProps {
  campaignId: string;
  onSelect?: (content: any) => void;
}

/**
 * Quick search and add component for homebrew content
 * Can be used in session notes, NPC editors, etc.
 */
export function HomebrewQuickAdd({
  campaignId,
  onSelect,
}: HomebrewQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const { data: searchResults, isLoading } =
    trpc.homebrew.searchContent.useQuery(
      {
        campaignId,
        query: searchQuery,
        type: selectedType !== 'all' ? (selectedType as any) : undefined,
        limit: 20,
      },
      {
        enabled: searchQuery.length > 0,
      }
    );

  const { data: recentContent } = trpc.homebrew.getContent.useQuery(
    {
      campaignId,
      limit: 10,
    },
    {
      enabled: searchQuery.length === 0,
    }
  );

  const content = searchQuery.length > 0 ? searchResults : recentContent?.items;

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      item: '⚔️',
      creature: '🐉',
      spell: '✨',
      location: '🗺️',
      subclass: '📜',
      feat: '💪',
      rule: '📖',
    };
    return icons[type] || '📄';
  };

  const getTypeColor = (type: string): any => {
    switch (type) {
      case 'item':
        return 'purple';
      case 'creature':
        return 'orange';
      case 'spell':
        return 'blue';
      case 'location':
        return 'green';
      case 'subclass':
        return 'violet';
      case 'feat':
        return 'yellow';
      case 'rule':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const handleSelect = (item: any) => {
    onSelect?.(item);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button variant="soft" size="2">
          📚 Add Homebrew
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 600, maxHeight: '80vh' }}>
        <Dialog.Title>Add Homebrew Content</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Search and add homebrew items, creatures, spells, and more to your session
        </Dialog.Description>

        {/* Search */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <TextField.Root
              placeholder="Search homebrew..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            >
              <TextField.Slot>
                <span>🔍</span>
              </TextField.Slot>
            </TextField.Root>

            <Select.Root value={selectedType} onValueChange={setSelectedType}>
              <Select.Trigger className="w-32" />
              <Select.Content>
                <Select.Item value="all">All Types</Select.Item>
                <Select.Item value="item">⚔️ Items</Select.Item>
                <Select.Item value="creature">🐉 Creatures</Select.Item>
                <Select.Item value="spell">✨ Spells</Select.Item>
                <Select.Item value="location">🗺️ Locations</Select.Item>
                <Select.Item value="feat">💪 Feats</Select.Item>
                <Select.Item value="rule">📖 Rules</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="text-center py-8 text-gray-400">Searching...</div>
            )}

            {!isLoading && (!content || content.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No results found' : 'No homebrew content yet'}
              </div>
            )}

            {!isLoading &&
              content &&
              content.map((item) => (
                <Card
                  key={item.id}
                  className="p-3 hover:bg-gray-800/70 transition-colors cursor-pointer"
                  onClick={() => handleSelect(item)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Text weight="bold" className="truncate">
                          {item.name}
                        </Text>
                        <Badge color={getTypeColor(item.type)} size="1">
                          {item.type}
                        </Badge>
                      </div>

                      {item.data?.description && (
                        <Text size="1" className="text-gray-400 line-clamp-2">
                          {typeof item.data.description === 'string'
                            ? item.data.description
                            : JSON.stringify(item.data.description).substring(
                                0,
                                100
                              )}
                        </Text>
                      )}

                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {item.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="soft" size="1">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
