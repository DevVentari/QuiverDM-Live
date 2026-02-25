'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
interface CustomSection { label: string; content: string; }
export function CustomSections({ data }: { data: Record<string, unknown> }) {
  const sections = data.customSections as CustomSection[] | undefined;
  if (!sections?.length) return null;
  return (
    <>
      {sections.map((section, i) => (
        <Card key={i}>
          <CardHeader className="pb-3"><CardTitle className="text-sm">{section.label}</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{section.content}</p></CardContent>
        </Card>
      ))}
    </>
  );
}
