# Phase 4: UI Components - Planning Document

## Overview

Beautiful image galleries and generation UI on homebrew detail pages.

**Goal:** Provide intuitive, responsive UI for viewing, uploading, generating, and managing images.

**Timeline:** Week 6-7 (14 days)

## Objectives

1. ✅ Image gallery component with lightbox
2. ✅ Image upload dialog with drag-and-drop
3. ✅ Image generation dialog with progress
4. ✅ Integrate into all homebrew detail pages
5. ✅ Responsive design (mobile, tablet, desktop)
6. ✅ Accessibility (keyboard nav, screen readers)

## Architecture Design

### Component Hierarchy

```
HomebrewDetailPage
  └── ImageGallery
      ├── ImageGrid (masonry or grid layout)
      │   └── ImageCard (thumbnail, hover actions)
      ├── ImageLightbox (full-size view)
      ├── UploadButton → ImageUploadDialog
      └── GenerateButton → ImageGenerationDialog
```

### User Flows

**Flow 1: View Images**
```
User opens homebrew item detail page
  ↓
ImageGallery renders existing images
  ↓
User clicks image thumbnail
  ↓
Lightbox opens with full-size image
  ↓
User navigates between images with arrow keys
```

**Flow 2: Upload Image**
```
User clicks "Upload Image" button (owner only)
  ↓
ImageUploadDialog opens
  ↓
User drags file or clicks to select
  ↓
Preview shown with file details
  ↓
User confirms upload
  ↓
POST /api/upload/homebrew-image
  ↓
Image appears in gallery immediately
```

**Flow 3: Generate Image**
```
User clicks "Generate Image" button (owner only)
  ↓
ImageGenerationDialog opens
  ↓
User sees auto-generated prompt (can customize in advanced mode)
  ↓
User sees provider selection (ComfyUI, Replicate, DALL-E)
  ↓
User sees cost estimate and remaining quota
  ↓
User confirms generation
  ↓
Progress bar shows generation status
  ↓
WebSocket updates progress in real-time
  ↓
Generated image appears in gallery
```

## Files to Create

### 1. `src/components/homebrew/details/ImageGallery.tsx`

**Purpose:** Main gallery component with grid layout and lightbox

**Props:**
```typescript
interface ImageGalleryProps {
  homebrewId: string;
  images: string[];        // Array of image URLs
  isOwner: boolean;        // Can upload/generate/delete
  itemType: string;        // For prompt generation
  itemName: string;
  itemDescription?: string;
}
```

**Features:**
- Masonry grid layout (like Pinterest)
- Lazy loading for performance
- Hover overlay with actions (view, delete)
- Empty state with call-to-action
- Loading skeletons

**Implementation:**
```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Trash2, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from './ImageLightbox';
import { ImageUploadDialog } from '../ImageUploadDialog';
import { ImageGenerationDialog } from '../ImageGenerationDialog';
import { trpc } from '@/lib/trpc';

export function ImageGallery({
  homebrewId,
  images,
  isOwner,
  itemType,
  itemName,
  itemDescription,
}: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const deleteImage = trpc.homebrewImage.deleteImage.useMutation();

  const handleDelete = async (imageUrl: string) => {
    if (!confirm('Delete this image?')) return;

    await deleteImage.mutateAsync({
      homebrewId,
      imageUrl,
    });
  };

  if (images.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <p className="text-muted-foreground mb-4">No images yet</p>
        {isOwner && (
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
            <Button onClick={() => setGenerateOpen(true)} variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
            </Button>
          </div>
        )}

        <ImageUploadDialog
          homebrewId={homebrewId}
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
        />
        <ImageGenerationDialog
          homebrewId={homebrewId}
          itemType={itemType}
          itemName={itemName}
          itemDescription={itemDescription}
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      {isOwner && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate
          </Button>
        </div>
      )}

      {/* Masonry grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
        {images.map((url, idx) => (
          <div
            key={url}
            className="break-inside-avoid mb-4 group relative cursor-pointer"
            onClick={() => setLightboxIndex(idx)}
          >
            <Image
              src={url}
              alt={`${itemName} image ${idx + 1}`}
              width={400}
              height={400}
              className="rounded-lg w-full h-auto object-cover"
            />

            {/* Hover overlay */}
            {isOwner && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(url);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={images}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        itemName={itemName}
      />

      {/* Dialogs */}
      <ImageUploadDialog
        homebrewId={homebrewId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
      <ImageGenerationDialog
        homebrewId={homebrewId}
        itemType={itemType}
        itemName={itemName}
        itemDescription={itemDescription}
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
    </div>
  );
}
```

### 2. `src/components/homebrew/details/ImageLightbox.tsx`

**Purpose:** Full-screen image viewer with navigation

**Features:**
- Full-screen overlay
- Previous/Next navigation
- Keyboard shortcuts (arrow keys, ESC)
- Touch gestures for mobile
- Image counter (1 of 5)
- Close button

**Implementation:**
```tsx
'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number | null;
  onClose: () => void;
  itemName: string;
}

export function ImageLightbox({
  images,
  currentIndex,
  onClose,
  itemName,
}: ImageLightboxProps) {
  useEffect(() => {
    if (currentIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (currentIndex === null) return null;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev! - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev! + 1) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        className="absolute top-4 right-4"
        variant="ghost"
        size="icon"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white">
        {currentIndex + 1} of {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <Button
          className="absolute left-4 top-1/2 -translate-y-1/2"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      {/* Image */}
      <div className="max-w-7xl max-h-screen p-4" onClick={(e) => e.stopPropagation()}>
        <Image
          src={images[currentIndex]}
          alt={`${itemName} image ${currentIndex + 1}`}
          width={1200}
          height={1200}
          className="max-h-[90vh] w-auto object-contain"
          priority
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <Button
          className="absolute right-4 top-1/2 -translate-y-1/2"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}
    </div>
  );
}
```

### 3. `src/components/homebrew/ImageUploadDialog.tsx`

**Purpose:** Drag-and-drop image upload with preview

**Features:**
- Drag-and-drop zone
- File picker fallback
- Image preview before upload
- File size/type validation
- Progress indicator
- Success/error feedback

**Implementation:**
```tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface ImageUploadDialogProps {
  homebrewId: string;
  open: boolean;
  onClose: () => void;
}

export function ImageUploadDialog({
  homebrewId,
  open,
  onClose,
}: ImageUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const utils = trpc.useUtils();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    setFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('homebrewId', homebrewId);

      const response = await fetch('/api/upload/homebrew-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { url } = await response.json();

      // Update homebrew content images array via tRPC
      await utils.homebrew.getById.invalidate({ id: homebrewId });

      toast.success('Image uploaded successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Image</DialogTitle>
        </DialogHeader>

        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? 'Drop image here' : 'Drag & drop or click to select'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              JPEG, PNG, WebP, or GIF (max 5MB)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative">
              <img
                src={preview!}
                alt="Preview"
                className="w-full rounded-lg"
              />
              <Button
                className="absolute top-2 right-2"
                variant="destructive"
                size="icon"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* File info */}
            <div className="text-sm text-muted-foreground">
              <p>{file.name}</p>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>

            {/* Progress */}
            {uploading && (
              <Progress value={progress} />
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="flex-1">
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 4. `src/components/homebrew/ImageGenerationDialog.tsx`

**Purpose:** AI image generation with progress tracking

**Features:**
- Auto-generated prompt (editable in advanced mode)
- Provider selection (ComfyUI, Replicate, DALL-E)
- Cost estimate display
- Remaining quota display
- Real-time progress updates via WebSocket
- Cancel generation option

**Implementation:** (See detailed spec in separate file due to length)

### 5. Integration into Detail Pages

Update these files to add `<ImageGallery>` component:

- `src/components/homebrew/details/ItemDetail.tsx`
- `src/components/homebrew/details/SpellDetail.tsx`
- `src/components/homebrew/details/CreatureDetail.tsx`
- `src/components/homebrew/details/GenericDetail.tsx`

**Pattern:**
```tsx
<div className="space-y-6">
  {/* Existing content */}
  <div>
    <h2>{item.name}</h2>
    <p>{item.description}</p>
  </div>

  {/* NEW: Image Gallery */}
  <ImageGallery
    homebrewId={item.id}
    images={item.images || []}
    isOwner={item.userId === session?.user?.id}
    itemType={item.type}
    itemName={item.name}
    itemDescription={item.data?.description}
  />

  {/* Rest of content */}
</div>
```

## Implementation Sequence

### Day 1-3: Core Components

1. Create ImageGallery component
2. Create ImageLightbox component
3. Add keyboard navigation
4. Test responsiveness

### Day 4-5: Upload Dialog

1. Create ImageUploadDialog
2. Implement drag-and-drop
3. Add file validation
4. Test upload flow

### Day 6-7: Generation Dialog

1. Create ImageGenerationDialog
2. Add provider selection
3. Implement progress tracking
4. Add WebSocket updates

### Day 8-9: Integration

1. Add ImageGallery to all detail pages
2. Test with different item types
3. Ensure consistent styling
4. Fix layout issues

### Day 10-14: Polish + Testing

1. Responsive design testing
2. Accessibility audit
3. Performance optimization
4. Browser compatibility testing
5. User testing session

## Testing Strategy

### Component Tests

- ImageGallery renders correctly
- Lightbox navigation works
- Upload validation catches errors
- Generation dialog shows progress

### Integration Tests

- Upload → Gallery update
- Generate → Progress → Gallery update
- Delete → Gallery update
- WebSocket updates reflected in UI

### Accessibility Tests

- Keyboard navigation works
- Screen reader announcements correct
- Focus management in dialogs
- ARIA labels present

### Responsive Tests

- Mobile (375px)
- Tablet (768px)
- Desktop (1024px+)
- Ultra-wide (1920px+)

### Browser Tests

- Chrome
- Firefox
- Safari
- Edge

## Success Metrics

- [ ] Images display in masonry grid
- [ ] Lightbox opens on click
- [ ] Upload works via drag-and-drop and file picker
- [ ] Generation shows real-time progress
- [ ] WebSocket updates work
- [ ] Responsive on all screen sizes
- [ ] Keyboard navigation functional
- [ ] Screen reader compatible

## Critical Considerations

1. **Performance:** Lazy load images, use Next.js Image optimization
2. **Accessibility:** Proper ARIA labels, keyboard shortcuts
3. **Mobile UX:** Touch gestures, large tap targets
4. **Loading States:** Skeleton loaders, progress indicators
5. **Error Handling:** Clear error messages, retry options

## Questions to Resolve

1. Masonry vs grid layout?
2. Allow reordering images?
3. Set featured/primary image?
4. Bulk upload support?
5. Image editing (crop, rotate)?

## Dependencies

**Requires:**
- Phase 1: Image URLs in HomebrewContent
- Phase 2: Generation endpoint working
- Phase 3: Provider fallback working
