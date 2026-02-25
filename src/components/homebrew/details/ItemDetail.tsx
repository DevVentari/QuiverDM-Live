'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wand2, Zap } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { htmlToText } from '@/lib/html-utils';
import { CustomSections } from './CustomSections';
import type { ItemEffect } from '@/lib/dnd-schemas';

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
  const effects = Array.isArray(data.effects) ? (data.effects as ItemEffect[]) : [];

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

      {effects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Effects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple">
              {effects.map((effect, idx) => (
                <AccordionItem key={idx} value={String(idx)} className="px-4">
                  <AccordionTrigger className="py-2.5 text-sm font-medium hover:no-underline">
                    {effect.name}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 text-sm text-muted-foreground">
                    <p className="whitespace-pre-wrap">{effect.description}</p>
                    {effect.mechanic && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {effect.mechanic.type.replace(/_/g, ' ')}
                        </Badge>
                        {effect.mechanic.target && (
                          <Badge variant="outline" className="text-xs">{effect.mechanic.target}</Badge>
                        )}
                        {effect.mechanic.value != null && (
                          <Badge variant="outline" className="text-xs">+{effect.mechanic.value}</Badge>
                        )}
                        {effect.mechanic.condition && (
                          <span className="text-xs italic text-muted-foreground">{effect.mechanic.condition}</span>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {(data.lore || data.description || data.text) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {htmlToText(data.lore || data.description || data.text || '')}
            </p>
          </CardContent>
        </Card>
      )}

      <CustomSections data={data} />
    </div>
  );
}
