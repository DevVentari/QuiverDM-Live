'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  itemName: string;
}

export function ImageLightbox({ images, currentIndex, onClose, onNavigate, itemName }: ImageLightboxProps) {
  useEffect(() => {
    if (currentIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate((currentIndex - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onNavigate((currentIndex + 1) % images.length);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  if (currentIndex === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <Button
        className="absolute top-4 right-4 text-white"
        variant="ghost"
        size="icon"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm">
        {currentIndex + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <Button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((currentIndex - 1 + images.length) % images.length);
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      <div className="max-w-7xl max-h-screen p-4" onClick={(e) => e.stopPropagation()}>
        <Image
          src={images[currentIndex]}
          alt={`${itemName} image ${currentIndex + 1}`}
          width={1200}
          height={1200}
          className="max-h-[90vh] w-auto object-contain"
          priority
          unoptimized
        />
      </div>

      {images.length > 1 && (
        <Button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((currentIndex + 1) % images.length);
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}
    </div>
  );
}
