'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Trash2, Plus, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { ImageLightbox } from './ImageLightbox';
import { ImageUploadDialog } from '../ImageUploadDialog';

interface ImageGalleryProps {
  homebrewId: string;
  images: string[];
  isOwner: boolean;
  itemName: string;
}

export function ImageGallery({ homebrewId, images, isOwner, itemName }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const utils = trpc.useUtils();

  const removeImage = trpc.homebrew.removeImage.useMutation({
    onSuccess: () => {
      utils.homebrew.getContentById.invalidate({ id: homebrewId });
      toast.success('Image removed');
    },
    onError: () => toast.error('Failed to remove image'),
  });

  const handleDelete = (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this image?')) return;
    removeImage.mutate({ id: homebrewId, imageUrl });
  };

  if (images.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground mb-4">No images yet</p>
        {isOwner && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload Image
          </Button>
        )}
        <ImageUploadDialog homebrewId={homebrewId} open={uploadOpen} onClose={() => setUploadOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOwner && (
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
      )}

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
        {images.map((url, idx) => (
          <div
            key={url}
            className="break-inside-avoid mb-3 group relative cursor-pointer rounded-lg overflow-hidden"
            onClick={() => setLightboxIndex(idx)}
          >
            <Image
              src={url}
              alt={`${itemName} image ${idx + 1}`}
              width={400}
              height={400}
              className="w-full h-auto object-cover"
              unoptimized
            />
            {isOwner && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={(e) => handleDelete(url, e)}
                  disabled={removeImage.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ImageLightbox
        images={images}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        itemName={itemName}
      />

      <ImageUploadDialog homebrewId={homebrewId} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
