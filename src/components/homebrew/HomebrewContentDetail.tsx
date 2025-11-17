'use client';

import { trpc } from '@/lib/trpc';
import { Button, Card, Badge, Heading, Text } from '@radix-ui/themes';
import { formatDistanceToNow } from 'date-fns';

interface HomebrewContentDetailProps {
  contentId: string;
  onClose?: () => void;
  onEdit?: (contentId: string) => void;
}

export function HomebrewContentDetail({
  contentId,
  onClose,
  onEdit,
}: HomebrewContentDetailProps) {
  const { data: content, isLoading } = trpc.homebrew.getContentById.useQuery({
    id: contentId,
  });

  const deleteContentMutation = trpc.homebrew.deleteContent.useMutation({
    onSuccess: () => {
      onClose?.();
    },
  });

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this content?')) {
      await deleteContentMutation.mutateAsync({ id: contentId });
    }
  };

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

  const renderDataField = (key: string, value: any): React.ReactNode => {
    if (typeof value === 'string') {
      return (
        <div key={key} className="space-y-1">
          <Text size="2" weight="bold" className="capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}:
          </Text>
          <Text size="2" className="text-gray-300 whitespace-pre-wrap">
            {value}
          </Text>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-1">
          <Text size="2" weight="bold" className="capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}:
          </Text>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            {value.map((item, idx) => (
              <li key={idx}>
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="space-y-2">
          <Text size="2" weight="bold" className="capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}:
          </Text>
          <div className="pl-4 space-y-2">
            {Object.entries(value).map(([k, v]) => renderDataField(k, v))}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <Text size="2" weight="bold" className="capitalize">
          {key.replace(/([A-Z])/g, ' $1').trim()}:
        </Text>
        <Text size="2" className="text-gray-300">
          {String(value)}
        </Text>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>Content not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-4xl">{getTypeIcon(content.type)}</span>
          <div className="flex-1 min-w-0">
            <Heading size="6" className="mb-2">
              {content.name}
            </Heading>
            <div className="flex items-center gap-2">
              <Badge color={getTypeColor(content.type)} size="2">
                {content.type}
              </Badge>
              {content.tags.map((tag) => (
                <Badge key={tag} variant="soft" size="1">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        )}
      </div>

      {/* Source Info */}
      {content.sourcePdf && (
        <Card className="p-4 bg-gray-800/30">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Source:</span>
            <span className="text-gray-300">{content.sourcePdf.filename}</span>
          </div>
        </Card>
      )}

      {/* Content Data */}
      <Card className="p-6">
        <div className="space-y-4">
          {Object.entries(content.data as Record<string, any>).map(
            ([key, value]) => renderDataField(key, value)
          )}
        </div>
      </Card>

      {/* Images */}
      {content.images.length > 0 && (
        <div className="space-y-3">
          <Heading size="4">Images</Heading>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {content.images.map((imageUrl, idx) => (
              <img
                key={idx}
                src={imageUrl}
                alt={`${content.name} ${idx + 1}`}
                className="rounded-lg w-full h-48 object-cover border border-gray-700"
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 flex items-center gap-4">
        <span>
          Created {formatDistanceToNow(new Date(content.createdAt), { addSuffix: true })}
        </span>
        {content.updatedAt !== content.createdAt && (
          <span>
            Updated{' '}
            {formatDistanceToNow(new Date(content.updatedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-800">
        {onEdit && (
          <Button variant="soft" onClick={() => onEdit(contentId)}>
            Edit
          </Button>
        )}
        <Button
          color="red"
          variant="soft"
          onClick={handleDelete}
          disabled={deleteContentMutation.isPending}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
