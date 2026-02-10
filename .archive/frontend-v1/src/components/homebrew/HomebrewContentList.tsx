'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button, Card, Badge, Select, TextField } from '@radix-ui/themes';

interface HomebrewContentListProps {
  campaignId: string;
  onContentClick?: (contentId: string) => void;
}

const CONTENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'item', label: 'Items', icon: '⚔️' },
  { value: 'creature', label: 'Creatures', icon: '🐉' },
  { value: 'spell', label: 'Spells', icon: '✨' },
  { value: 'location', label: 'Locations', icon: '🗺️' },
  { value: 'subclass', label: 'Subclasses', icon: '📜' },
  { value: 'feat', label: 'Feats', icon: '💪' },
  { value: 'rule', label: 'Rules', icon: '📖' },
];

export function HomebrewContentList({
  campaignId,
  onContentClick,
}: HomebrewContentListProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Use search query if present, otherwise use filtered list
  const { data: contentData, isLoading } =
    trpc.homebrew.getContent.useQuery(
      {
        campaignId,
        search: debouncedQuery.length > 0 ? debouncedQuery : undefined,
        type: selectedType !== 'all' ? (selectedType as any) : undefined,
      }
    );

  const content = contentData?.items;

  const getTypeIcon = (type: string) => {
    return CONTENT_TYPES.find((t) => t.value === type)?.icon || '📄';
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <TextField.Root
          placeholder="Search homebrew content..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1"
        >
          <TextField.Slot>
            <span>🔍</span>
          </TextField.Slot>
        </TextField.Root>

        <Select.Root value={selectedType} onValueChange={setSelectedType}>
          <Select.Trigger className="w-48" />
          <Select.Content>
            {CONTENT_TYPES.map((type) => (
              <Select.Item key={type.value} value={type.value}>
                {type.icon && `${type.icon} `}
                {type.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>

      {/* Content List */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-400">Loading content...</div>
        </div>
      )}

      {!isLoading && (!content || content.length === 0) && (
        <div className="text-center p-8 text-gray-500">
          <div className="text-5xl mb-4">📚</div>
          <p>
            {debouncedQuery
              ? 'No content found matching your search'
              : 'No homebrew content found'}
          </p>
          <p className="text-sm mt-2">
            Upload a PDF or create content manually
          </p>
        </div>
      )}

      {!isLoading && content && content.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.map((item) => (
            <Card
              key={item.id}
              className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={() => onContentClick?.(item.id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                    <h3 className="font-medium text-gray-100 truncate">
                      {item.name}
                    </h3>
                  </div>
                  <Badge color={getTypeColor(item.type)}>
                    {item.type}
                  </Badge>
                </div>

                {(item.data as any)?.description && (
                  <p className="text-sm text-gray-400 line-clamp-3">
                    {typeof (item.data as any).description === 'string'
                      ? (item.data as any).description
                      : JSON.stringify((item.data as any).description).substring(0, 150)}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="soft" size="1">
                      {tag}
                    </Badge>
                  ))}
                  {item.tags.length > 3 && (
                    <Badge variant="soft" size="1">
                      +{item.tags.length - 3}
                    </Badge>
                  )}
                </div>

                {item.sourceType && item.sourceType !== 'manual' && (
                  <div className="text-xs text-gray-500 truncate">
                    Source: {item.sourceType}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
