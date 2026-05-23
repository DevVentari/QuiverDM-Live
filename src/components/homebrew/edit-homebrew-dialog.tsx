'use client';

import { FormEvent, KeyboardEvent, useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';

interface EditHomebrewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  item: {
    id: string;
    name: string;
    tags?: string[];
    data?: Record<string, unknown>;
  };
}

export function EditHomebrewDialog({ open, onOpenChange, onUpdated, item }: EditHomebrewDialogProps) {
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>(item.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  // Sync state when item changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(item.name);
      setTags(item.tags ?? []);
      setTagInput('');
      // Extract description from data field
      const desc = (item.data as Record<string, unknown> | undefined)?.description;
      setContent(typeof desc === 'string' ? desc : '');
    }
  }, [open, item]);

  const updateContent = trpc.homebrew.updateContent.useMutation({
    onSuccess: () => {
      toast.success('Homebrew updated');
      onOpenChange(false);
      onUpdated();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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
    updateContent.mutate({
      id: item.id,
      name: trimmedName,
      tags,
      data: { ...(item.data as object ?? {}), description: content },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Homebrew Content</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="glass-panel glass-grain rounded-xl p-4 space-y-4">
            <div>
              <p className="label-overline mb-1">Details</p>
              <div className="section-rule mb-3" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-homebrew-name">Name</Label>
              <Input
                id="edit-homebrew-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter a name"
                required
                minLength={2}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-homebrew-tags">Tags</Label>
              <Input
                id="edit-homebrew-tags"
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
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-homebrew-content">Content (Markdown)</Label>
              <Textarea
                id="edit-homebrew-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your markdown content..."
                rows={8}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateContent.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateContent.isPending}>
              {updateContent.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
