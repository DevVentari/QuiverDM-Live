'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2 } from 'lucide-react';

interface ItemDetailProps {
  data: any;
}

function DetailRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
    </div>
  );
}

export function ItemDetail({ data }: ItemDetailProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Item Details</CardTitle>
            {data.rarity && (
              <Badge variant="outline" className="ml-auto text-amber-500 border-amber-500/20 capitalize">
                {data.rarity}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <DetailRow label="Type" value={data.item_type || data.type} />
          <DetailRow label="Rarity" value={data.rarity} />
          <DetailRow label="Attunement" value={data.requires_attunement || data.attunement} />
          <DetailRow label="Weight" value={data.weight ? `${data.weight} lb.` : undefined} />
          <DetailRow label="Value" value={data.value || data.cost} />
          <DetailRow label="Damage" value={data.damage} />
          <DetailRow label="Damage Type" value={data.damage_type} />
          {data.properties && (
            <DetailRow label="Properties" value={
              Array.isArray(data.properties) ? data.properties.join(', ') : data.properties
            } />
          )}
        </CardContent>
      </Card>

      {(data.description || data.text) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.description || data.text}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
