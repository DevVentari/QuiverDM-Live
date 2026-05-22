'use client';

import Link from 'next/link';
import { FileText, Pencil, Globe } from 'lucide-react';
import { EntityCard } from '@/components/primitives/EntityCard';
import { EntityPlaceholder, type PlaceholderEntityType } from '@/components/primitives/entity-placeholder';
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

const TYPE_TO_PLACEHOLDER: Record<string, PlaceholderEntityType> = {
  spell: 'spell', monster: 'monster', creature: 'monster', item: 'item', weapon: 'weapon',
  feat: 'sourcebook', race: 'npc', subclass: 'npc', background: 'sourcebook', location: 'location',
}

const TYPE_BADGE_TONE: Record<string, 'neutral' | 'amber' | 'danger' | 'arcane'> = {
  spell: 'arcane', creature: 'danger', monster: 'danger',
  item: 'amber', weapon: 'amber',
}

export function HomebrewContentCard({ item, href, onClick }: HomebrewContentCardProps) {
  const normalizedType = item.type.toLowerCase();
  const style = getTypeStyle(normalizedType);
  const imageUrl = item.imageUrl ?? item.images?.[0];
  const placeholderType: PlaceholderEntityType = TYPE_TO_PLACEHOLDER[normalizedType] ?? 'item';

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
      imageFallback={<EntityPlaceholder type={placeholderType} />}
      title={item.name}
      badge={{ label: style.label, tone: TYPE_BADGE_TONE[normalizedType] ?? 'neutral' }}
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
