'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BookOpen } from 'lucide-react';
import { htmlToText } from '@/lib/html-utils';

export function CharacterFeatures({ data }: { data: any }) {
  const features = data.features as any[] | null;

  if (!features?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BookOpen className="h-8 w-8 mb-2" />
        <p>No features</p>
      </div>
    );
  }

  // Group by source
  const grouped: Record<string, any[]> = {};
  for (const feat of features) {
    const source = feat.source || 'Other';
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(feat);
  }

  const sources = Object.keys(grouped).sort((a, b) => {
    // Class sources first, then Race, then Feat, then Other
    const order = (s: string) => {
      if (s === 'Feat') return 2;
      if (s === 'Other') return 3;
      if (s.toLowerCase().includes('race') || grouped[s][0]?.source === data.race) return 1;
      return 0; // Class sources first
    };
    return order(a) - order(b);
  });

  return (
    <div className="space-y-4">
      {sources.map((source) => (
        <Card key={source}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm tracking-wide flex items-center gap-2">
              {source}
              <Badge variant="secondary" className="text-xs font-sans">
                {grouped[source].length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {grouped[source].map((feat: any, idx: number) => (
                <AccordionItem
                  key={`${feat.name}-${idx}`}
                  value={`${feat.name}-${idx}`}
                >
                  <AccordionTrigger className="py-2 text-sm hover:no-underline">
                    <span className="font-medium text-left">{feat.name}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3">
                    {feat.description ? (
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {htmlToText(feat.description)}
                      </p>
                    ) : (
                      <p className="italic">No description available</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
