'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomSection {
  label: string;
  content: string;
}

interface CustomSectionsProps {
  data: Record<string, unknown>;
}

export function CustomSections({ data }: CustomSectionsProps) {
  const raw = data.customSections;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const sections = (raw as unknown[]).filter(
    (s): s is CustomSection =>
      s !== null &&
      typeof s === 'object' &&
      typeof (s as CustomSection).label === 'string' &&
      typeof (s as CustomSection).content === 'string'
  );
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <Card key={section.label}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{section.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{section.content}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
