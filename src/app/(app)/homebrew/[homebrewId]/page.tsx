'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getTypeStyle, getSourceLabel, formatPdfName } from '@/lib/homebrew-utils';
import { SpellDetail } from '@/components/homebrew/details/SpellDetail';
import { CreatureDetail } from '@/components/homebrew/details/CreatureDetail';
import { ItemDetail } from '@/components/homebrew/details/ItemDetail';
import { GenericDetail } from '@/components/homebrew/details/GenericDetail';
import { AddToCharacterButton } from '@/components/homebrew/AddToCharacterButton';
import { ImageGallery } from '@/components/homebrew/details/ImageGallery';

export default function HomebrewDetailPage() {
  const params = useParams();
  const homebrewId = params.homebrewId as string;
  const { data: session } = useSession();

  const content = trpc.homebrew.getContentById.useQuery(
    { id: homebrewId },
    { staleTime: 120_000 }
  );

  if (content.isLoading) {
    return (
      <div className="space-y-6 max-w-3xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (content.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load content</p>
          <p className="text-sm text-muted-foreground">
            {content.error?.message || 'An unexpected error occurred'}
          </p>
          <Button variant="outline" onClick={() => content.refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const item = content.data as any;
  if (!item) {
    return <p className="text-destructive">Content not found</p>;
  }

  const style = getTypeStyle(item.type);
  const TypeIcon = style.icon;
  const itemData = item.data || {};
  const isOwner = session?.user?.id === item.userId;
  const linkableType = ['item', 'spell', 'feat'].includes(item.type)
    ? (item.type as 'item' | 'spell' | 'feat')
    : null;

  function renderDetail() {
    switch (item.type) {
      case 'spell':
        return <SpellDetail data={itemData} />;
      case 'creature':
        return <CreatureDetail data={itemData} />;
      case 'item':
        return <ItemDetail data={itemData} />;
      default:
        return <GenericDetail data={itemData} typeName={style.label} />;
    }
  }

  return (
    <div className="space-y-6 max-w-3xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/homebrew">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold truncate">{item.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-xs ${style.color}`}>
              {style.label}
            </Badge>
            {item.sourceType && (
              <span className="text-xs text-muted-foreground">
                {item.sourceType === 'pdf_extraction' && item.sourcePdf
                  ? `PDF · ${formatPdfName(item.sourcePdf.filename)}`
                  : getSourceLabel(item.sourceType)}
              </span>
            )}
          </div>
        </div>
        {linkableType && (
          <AddToCharacterButton
            homebrewId={item.id}
            homebrewName={item.name}
            homebrewType={linkableType}
          />
        )}
      </div>

      {/* Type-specific detail renderer */}
      {renderDetail()}

      {/* Image Gallery */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Images</h2>
        <ImageGallery
          homebrewId={item.id}
          images={item.images ?? []}
          isOwner={isOwner}
          itemName={item.name}
          itemType={item.type}
          itemDescription={itemData?.description}
          imagePromptHint={itemData?.imagePromptHint}
        />
      </div>

      {/* Raw data collapsible */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-2">
          Raw Data (JSON)
        </summary>
        <pre className="mt-2 p-4 rounded-lg bg-muted/50 border overflow-x-auto text-xs">
          {JSON.stringify(itemData, null, 2)}
        </pre>
      </details>
    </div>
  );
}
