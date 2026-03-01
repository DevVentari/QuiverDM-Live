'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardDescription } from '@/components/ui/card';
import { FileText, Pencil, Globe } from 'lucide-react';
import { getTypeStyle, getSourceLabel, formatPdfName } from '@/lib/homebrew-utils';

interface HomebrewContentCardProps {
  item: {
    id: string;
    name: string;
    type: string;
    sourceType?: string;
    sourcePdf?: { filename: string } | null;
    data?: any;
    tags?: string[];
    images?: string[];
    imageUrl?: string | null;
  };
  href?: string;
}

export function HomebrewContentCard({ item, href }: HomebrewContentCardProps) {
  const style = getTypeStyle(item.type);
  const TypeIcon = style.icon;
  const imageUrl = item.imageUrl ?? item.images?.[0];

  const sourceIcon = item.sourceType === 'pdf_extraction' ? FileText
    : item.sourceType === 'dndbeyond_import' ? Globe
    : Pencil;
  const SourceIcon = sourceIcon;

  const card = (
    <Card className="glass-panel group transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden">
      {imageUrl ? (
        <div className="relative h-24 w-full">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className={`h-24 w-full flex items-center justify-center bg-gradient-to-br ${style.gradient}`}>
          <TypeIcon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base truncate">{item.name}</CardTitle>
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
              <span>
                {item.sourceType === 'pdf_extraction' && item.sourcePdf
                  ? `PDF · ${formatPdfName(item.sourcePdf.filename)}`
                  : getSourceLabel(item.sourceType)}
              </span>
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
