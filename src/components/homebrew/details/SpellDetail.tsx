'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface SpellDetailProps {
  data: any;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

export function SpellDetail({ data }: SpellDetailProps) {
  const level = data.level ?? data.spell_level;
  const levelLabel = level === 0 ? 'Cantrip' : `Level ${level}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-lg">Spell Details</CardTitle>
            <Badge variant="outline" className="ml-auto text-violet-500 border-violet-500/20">
              {levelLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <DetailRow label="School" value={data.school} />
          <DetailRow label="Casting Time" value={data.casting_time || data.castingTime} />
          <DetailRow label="Range" value={data.range} />
          <DetailRow label="Components" value={
            Array.isArray(data.components) ? data.components.join(', ') : data.components
          } />
          <DetailRow label="Duration" value={data.duration} />
          {data.concentration && (
            <DetailRow label="Concentration" value="Yes" />
          )}
          {data.ritual && (
            <DetailRow label="Ritual" value="Yes" />
          )}
          <DetailRow label="Classes" value={
            Array.isArray(data.classes) ? data.classes.join(', ') : data.classes
          } />
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

      {data.higher_levels && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">At Higher Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{data.higher_levels}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
