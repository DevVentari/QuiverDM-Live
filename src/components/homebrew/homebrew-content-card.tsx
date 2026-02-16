'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardDescription } from '@/components/ui/card';
import { FileText, Pencil, Globe } from 'lucide-react';
import { getTypeStyle, getSourceLabel } from '@/lib/homebrew-utils';

interface HomebrewContentCardProps {
  item: {
    id: string;
    name: string;
    type: string;
    sourceType?: string;
    data?: any;
    tags?: string[];
  };
  href?: string;
}

export function HomebrewContentCard({ item, href }: HomebrewContentCardProps) {
  const style = getTypeStyle(item.type);
  const TypeIcon = style.icon;

  const sourceIcon = item.sourceType === 'pdf_extraction' ? FileText
    : item.sourceType === 'dndbeyond_import' ? Globe
    : Pencil;
  const SourceIcon = sourceIcon;

  const card = (
    <Card className="group transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base truncate">{item.name}</CardTitle>
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ${style.color}`}>
            {style.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2">
          {item.data?.description || item.data?.text || 'No description'}
        </CardDescription>
        <div className="flex items-center gap-2 mt-2">
          {item.sourceType && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SourceIcon className="h-3 w-3" />
              <span>{getSourceLabel(item.sourceType)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }

  return card;
}
