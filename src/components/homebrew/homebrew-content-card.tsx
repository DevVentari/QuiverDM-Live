'use client';

import Link from 'next/link';
import { FileText, Pencil, Globe } from 'lucide-react';
import { EntityCard } from '@/components/primitives/EntityCard';
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
  onClick?: () => void;
}

export function HomebrewContentCard({ item, href, onClick }: HomebrewContentCardProps) {
  const style = getTypeStyle(item.type);
  const TypeIcon = style.icon;
  const imageUrl = item.imageUrl ?? item.images?.[0];

  const SourceIcon =
    item.sourceType === 'pdf_extraction'
      ? FileText
      : item.sourceType === 'dndbeyond_import'
        ? Globe
        : Pencil;

  const description = item.data?.description || item.data?.text || null;

  const footer = item.sourceType ? (
    <>
      <SourceIcon size={10} className="shrink-0" />
      <span className="truncate">
        {item.sourceType === 'pdf_extraction' && item.sourcePdf
          ? `PDF · ${formatPdfName(item.sourcePdf.filename)}`
          : getSourceLabel(item.sourceType)}
      </span>
    </>
  ) : null;

  const card = (
    <EntityCard
      imageUrl={imageUrl}
      imageFallback={<TypeIcon size={32} />}
      title={item.name}
      badge={{ label: style.label, tone: 'amber' }}
      description={description}
      footer={footer}
      onClick={onClick ?? (() => {})}
      testId={`hb-card-${item.id}`}
    />
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
