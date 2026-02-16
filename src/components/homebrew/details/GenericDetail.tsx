'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords } from 'lucide-react';

interface GenericDetailProps {
  data: any;
  typeName?: string;
}

export function GenericDetail({ data, typeName }: GenericDetailProps) {
  // Filter out internal/noisy keys
  const skipKeys = new Set(['id', 'userId', 'createdAt', 'updatedAt', 'searchText', 'images', 'tags']);
  const entries = Object.entries(data).filter(
    ([key, value]) => !skipKeys.has(key) && value !== null && value !== undefined && value !== ''
  );

  return (
    <div className="space-y-4">
      {(data.description || data.text) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{typeName || 'Details'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.description || data.text}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm font-medium text-muted-foreground capitalize">
                {key.replace(/_/g, ' ')}
              </span>
              <span className="text-sm text-right max-w-[60%] break-words">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
