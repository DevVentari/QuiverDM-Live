'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Upload, Sparkles, Square, ImageUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MapBackgroundPickerProps {
  open: boolean;
  onDone: () => void;
  campaignId: string;
  mapId?: string;
}

export function MapBackgroundPicker({ open, onDone, campaignId, mapId }: MapBackgroundPickerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'upload' | 'generate' | 'blank'>('blank');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createRootMutation = trpc.worldMap.createRoot.useMutation({
    onSuccess: () => {
      router.refresh();
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const setBlankMutation = trpc.worldMap.setBlankBackground.useMutation({
    onSuccess: () => { router.refresh(); onDone(); },
    onError: (err) => toast.error(err.message),
  });

  const generateMutation = trpc.worldMap.generateMapBackground.useMutation({
    onSuccess: () => { toast.info('Map generation queued — background will update when ready'); onDone(); },
    onError: (err) => toast.error(err.message),
  });

  const uploadMutation = trpc.worldMap.uploadMapBackground.useMutation({
    onSuccess: () => { router.refresh(); onDone(); },
    onError: (err) => toast.error(err.message),
  });

  const handleStartBlank = () => {
    if (!mapId) {
      createRootMutation.mutate({ campaignId, backgroundType: 'BLANK' });
    } else {
      setBlankMutation.mutate({ mapId, campaignId });
    }
  };

  const handleGenerate = () => {
    if (!mapId) {
      createRootMutation.mutate({ campaignId, backgroundType: 'BLANK' });
      return;
    }
    generateMutation.mutate({ mapId, campaignId, customPrompt: customPrompt || undefined });
  };

  const handleUpload = async () => {
    if (!uploadFile || !mapId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/upload/map-background', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      uploadMutation.mutate({ mapId, campaignId, backgroundUrl: data.url });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">Set map background</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="blank" className="flex-1 gap-1.5"><Square className="h-3.5 w-3.5" />Blank</TabsTrigger>
            <TabsTrigger value="generate" className="flex-1 gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="blank" className="mt-4">
            <p className="mb-4 text-sm text-muted-foreground">Start with a clean canvas. Add a background later.</p>
            <Button className="w-full" onClick={handleStartBlank} disabled={createRootMutation.isPending || setBlankMutation.isPending}>
              Start blank
            </Button>
          </TabsContent>
          <TabsContent value="generate" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">AI will generate a map based on your campaign. Optionally describe the style.</p>
            <Input
              placeholder="e.g. northern tundra, ruined empire, dense jungle archipelago"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <Button className="w-full gap-2" onClick={handleGenerate} disabled={generateMutation.isPending || createRootMutation.isPending}>
              <Sparkles className="h-4 w-4" />
              Generate map
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Upload a PNG, JPG, or WebP (Inkarnate export, hand-drawn scan, etc.). Max 20 MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <ImageUp className="h-5 w-5" />
              {uploadFile ? uploadFile.name : 'Choose a file…'}
            </button>
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!uploadFile || !mapId || uploading || uploadMutation.isPending}
            >
              {uploading ? 'Uploading…' : 'Set background'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
