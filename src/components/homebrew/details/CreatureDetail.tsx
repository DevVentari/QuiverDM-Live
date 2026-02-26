'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skull } from 'lucide-react';
import { htmlToText } from '@/lib/html-utils';
import { CustomSections } from './CustomSections';

interface CreatureDetailProps {
  data: any;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{String(value)}</span>
    </div>
  );
}

export function CreatureDetail({ data }: CreatureDetailProps) {
  const abilities = data.ability_scores || data.abilityScores || {};
  const hasAbilities = Object.keys(abilities).length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">Creature Stats</CardTitle>
            {data.challenge_rating != null && (
              <Badge variant="outline" className="ml-auto text-emerald-500 border-emerald-500/20">
                CR {data.challenge_rating}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <DetailRow label="Type" value={data.creature_type || data.type} />
          <DetailRow label="Size" value={data.size} />
          <DetailRow label="Alignment" value={data.alignment} />
          <DetailRow label="Armor Class" value={data.armor_class || data.ac} />
          <DetailRow label="Hit Points" value={data.hit_points || data.hp} />
          <DetailRow label="Speed" value={
            typeof data.speed === 'object'
              ? Object.entries(data.speed).map(([k, v]) => `${k} ${v}`).join(', ')
              : data.speed
          } />
        </CardContent>
      </Card>

      {hasAbilities && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ability Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
              {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((ability) => {
                const score = abilities[ability] ?? '—';
                const mod = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0;
                return (
                  <div key={ability}>
                    <div className="font-semibold text-xs text-muted-foreground uppercase">{ability}</div>
                    <div className="text-lg font-bold">{score}</div>
                    {typeof score === 'number' && (
                      <div className="text-xs text-muted-foreground">
                        ({mod >= 0 ? '+' : ''}{mod})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data.actions && data.actions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.actions.map((action: any, i: number) => (
              <div key={i}>
                <p className="text-sm font-medium">{action.name}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {htmlToText(action.description || action.desc || '')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.description || data.text) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{htmlToText(data.description || data.text || '')}</p>
          </CardContent>
        </Card>
      )}
      <CustomSections data={data} />
    </div>
  );
}
