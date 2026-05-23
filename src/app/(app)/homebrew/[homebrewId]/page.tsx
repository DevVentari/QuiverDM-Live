'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { getTypeStyle, getSourceLabel, formatPdfName } from '@/lib/homebrew-utils';
import { SpellDetail } from '@/components/homebrew/details/SpellDetail';
import { CreatureDetail } from '@/components/homebrew/details/CreatureDetail';
import { ItemDetail } from '@/components/homebrew/details/ItemDetail';
import { GenericDetail } from '@/components/homebrew/details/GenericDetail';
import { AddToCharacterButton } from '@/components/homebrew/AddToCharacterButton';
import { ImageGallery } from '@/components/homebrew/image-gallery';
import { EditHomebrewDialog } from '@/components/homebrew/edit-homebrew-dialog';

export default function HomebrewDetailPage() {
  const params = useParams();
  const homebrewId = params.homebrewId as string;
  const { data: session } = useSession();
  const [editOpen, setEditOpen] = useState(false);

  const content = trpc.homebrew.getContentById.useQuery(
    { id: homebrewId },
    { staleTime: 120_000 }
  );

  if (content.isLoading) {
    return (
      <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (content.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-[var(--q-text-danger)] font-medium">Failed to load content</p>
          <p className="text-sm text-[var(--q-text-dim)]">
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
    return <p className="text-[var(--q-text-danger)]">Content not found</p>;
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
    <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="label-overline mb-1">Homebrew</p>
        <div className="section-rule" />
        <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
          {item?.name ?? 'Loading…'}
        </h1>
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/homebrew">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-[var(--q-text-dim)] shrink-0" />
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide truncate">{item.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-xs ${style.color}`}>
              {style.label}
            </Badge>
            {item.sourceType && (
              <span className="text-xs text-[var(--q-text-dim)]">
                {item.sourceType === 'pdf_extraction' && item.sourcePdf
                  ? `PDF · ${formatPdfName(item.sourcePdf.filename)}`
                  : getSourceLabel(item.sourceType)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {linkableType && (
            <AddToCharacterButton
              homebrewId={item.id}
              homebrewName={item.name}
              homebrewType={linkableType}
            />
          )}
        </div>
      </div>

      {/* Edit dialog */}
      {isOwner && (
        <EditHomebrewDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={() => content.refetch()}
          item={{
            id: item.id,
            name: item.name,
            tags: item.tags ?? [],
            data: item.data as Record<string, unknown> | undefined,
          }}
        />
      )}

      {/* Main two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[3fr_1fr] items-start">
        {/* Left: type-specific detail renderer */}
        <div>
          {renderDetail()}
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Image Gallery */}
          <div className="stone-card">
            <div className="stone-card-header">
              <p className="label-overline mb-0.5">Gallery</p>
              <span className="stone-card-title">Images</span>
            </div>
            <div className="stone-card-body">
              <ImageGallery
                entityType="homebrew"
                entityId={item.id}
                currentImageUrl={item.imageUrl ?? item.images?.[0] ?? null}
                currentJobId={item.imageJobId}
                canGenerate={isOwner}
                entityName={item.name}
              />
            </div>
          </div>

          {/* Raw data collapsible */}
          <div className="stone-card">
            <div className="stone-card-header">
              <p className="label-overline mb-0.5">Debug</p>
              <span className="stone-card-title">Raw Data</span>
            </div>
            <div className="stone-card-body">
              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--q-text-dim)] hover:text-foreground transition-colors py-1">
                  View JSON
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-muted/50 border overflow-x-auto text-xs">
                  {JSON.stringify(itemData, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
