'use client';

import { FormEvent, KeyboardEvent, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ItemEffect } from '@/lib/dnd-schemas';
import { EffectConfirmationPanel } from './EffectConfirmationPanel';

interface CreateHomebrewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CONTENT_TYPES = [
  'item',
  'creature',
  'spell',
  'location',
  'subclass',
  'feat',
  'rule',
  'race',
  'class',
  'background',
  'character',
] as const;

type ContentType = (typeof CONTENT_TYPES)[number];

export function CreateHomebrewDialog({ open, onOpenChange, onCreated }: CreateHomebrewDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContentType>('item');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [detectedEffects, setDetectedEffects] = useState<ItemEffect[]>([]);

  const createContent = trpc.homebrew.createContent.useMutation({
    onSuccess: () => {
      toast.success('Homebrew created');
      resetForm();
      onOpenChange(false);
      onCreated();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setName('');
    setType('item');
    setContent('');
    setTags([]);
    setTagInput('');
    setDetectedEffects([]);
  };

  const addTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;
    if (tags.includes(tag)) return;
    setTags((prev) => [...prev, tag]);
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    addTag(tagInput);
    setTagInput('');
  };

  const handleTagBlur = () => {
    if (!tagInput.trim()) return;
    addTag(tagInput);
    setTagInput('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    createContent.mutate({
      name: trimmedName,
      type,
      tags,
      sourceType: 'manual',
      data: { description: content, effects: detectedEffects.length > 0 ? detectedEffects : undefined },
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Homebrew Content</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="homebrew-name">Name</Label>
            <Input
              id="homebrew-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter a name"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="homebrew-type">Type</Label>
            <Select value={type} onValueChange={(value: string) => setType(value as ContentType)}>
              <SelectTrigger id="homebrew-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((contentType) => (
                  <SelectItem key={contentType} value={contentType}>
                    {contentType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="homebrew-tags">Tags</Label>
            <Input
              id="homebrew-tags"
              value={tagInput}
              placeholder="Type a tag and press Enter or comma"
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleTagBlur}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setTags((prev) => prev.filter((value) => value !== tag))}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="homebrew-content">Content (Markdown)</Label>
            <Textarea
              id="homebrew-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write your markdown content..."
              rows={8}
            />
          </div>

          <EffectConfirmationPanel effects={detectedEffects} onChange={setDetectedEffects} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createContent.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createContent.isPending}>
              {createContent.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
