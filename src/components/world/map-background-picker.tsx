'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Upload, Sparkles, Square, ImageUp, BookImage, Map } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MapBackgroundPickerProps {
  open: boolean;
  onDone: () => void;
  campaignId: string;
  mapId?: string;
}

export function MapBackgroundPicker({ open, onDone, campaignId, mapId }: MapBackgroundPickerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'upload' | 'generate' | 'blank' | 'sourcebooks'>('blank');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourcebookMapsQuery = trpc.worldMap.listBackgroundSources.useQuery(
    { campaignId },
    { enabled: open }
  );

  const createRootMutation = trpc.worldMap.createRoot.useMutation();
  const setBlankMutation = trpc.worldMap.setBlankBackground.useMutation();
  const generateMutation = trpc.worldMap.generateMapBackground.useMutation();
  const uploadMutation = trpc.worldMap.uploadMapBackground.useMutation();

  const applyBackgroundUrl = async (backgroundUrl: string) => {
    if (!mapId) {
      await createRootMutation.mutateAsync({
        campaignId,
        backgroundType: 'UPLOADED',
        backgroundUrl,
      });
    } else {
      await uploadMutation.mutateAsync({ mapId, campaignId, backgroundUrl });
    }
    router.refresh();
    onDone();
  };

  const handleStartBlank = async () => {
    try {
      if (!mapId) {
        await createRootMutation.mutateAsync({ campaignId, backgroundType: 'BLANK' });
      } else {
        await setBlankMutation.mutateAsync({ mapId, campaignId });
      }
      router.refresh();
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to set background');
    }
  };

  const handleGenerate = async () => {
    try {
      if (!mapId) {
        await createRootMutation.mutateAsync({ campaignId, backgroundType: 'BLANK' });
        router.refresh();
        onDone();
        return;
      }
      await generateMutation.mutateAsync({ mapId, campaignId, customPrompt: customPrompt || undefined });
      toast.info('Map generation queued — background will update when ready');
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to queue generation');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/upload/map-background', { method: 'POST', body: form });
      if (!res.ok) {
        let errMsg = 'Upload failed';
        try { errMsg = (await res.json()).error ?? errMsg; } catch {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      await applyBackgroundUrl(data.url);
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col border-amber-500/20 bg-[linear-gradient(180deg,hsl(238_17%_12%/.97),hsl(240_16%_8%/.98))] p-0 overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="border-b border-amber-500/10 px-6 py-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">World Map</p>
            <DialogTitle className="mt-2 font-display text-xl text-amber-50">Choose a cartographic backdrop</DialogTitle>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/60">
              Start blank, conjure a fresh map, upload your own cartography, or reuse maps extracted from linked sourcebooks.
            </p>
          </div>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <TabsList className="mt-4 shrink-0 grid w-full grid-cols-4 bg-white/[0.04]">
            <TabsTrigger value="blank" className="gap-1.5"><Square className="h-3.5 w-3.5" />Blank</TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
            <TabsTrigger value="sourcebooks" className="gap-1.5"><BookImage className="h-3.5 w-3.5" />Sourcebooks</TabsTrigger>
          </TabsList>
          <TabsContent value="blank" className="mt-4">
            <p className="mb-4 text-sm text-amber-100/60">Start with a clean tactical field. Add a background later when the world sharpens into focus.</p>
            <Button className="w-full" onClick={handleStartBlank} disabled={createRootMutation.isPending || setBlankMutation.isPending}>
              Start blank
            </Button>
          </TabsContent>
          <TabsContent value="generate" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-amber-100/60">Generate a fresh cartographic plate tuned to the campaign mood. Add style notes if you want something more specific than the default world context.</p>
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
            <p className="text-sm text-amber-100/60">Upload a PNG, JPG, or WebP. Inkarnate exports, scanned sketches, and VTT-ready maps all work here.</p>
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
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-amber-500/20 bg-white/[0.03] py-8 text-sm text-amber-100/60 transition-colors hover:border-amber-400/40 hover:text-amber-50"
            >
              <ImageUp className="h-5 w-5" />
              {uploadFile ? uploadFile.name : 'Choose a file…'}
            </button>
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!uploadFile || uploading || uploadMutation.isPending || createRootMutation.isPending}
            >
              {uploading ? 'Uploading…' : 'Set background'}
            </Button>
          </TabsContent>
          <TabsContent value="sourcebooks" className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {sourcebookMapsQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl border border-white/10 bg-white/[0.03]" />
                ))}
              </div>
            ) : sourcebookMapsQuery.data && sourcebookMapsQuery.data.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sourcebookMapsQuery.data.map((map) => (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => void applyBackgroundUrl(map.url)}
                    className={cn(
                      'group overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.03] text-left transition',
                      'hover:border-amber-400/35 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden border-b border-white/10">
                      <Image
                        src={map.url}
                        alt={map.title}
                        fill
                        sizes="(max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100/70">
                        <Map className="h-3 w-3" />
                        Extracted Map
                      </div>
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      <div>
                        <p className="font-display text-sm text-amber-50">{map.title}</p>
                        <p className="mt-1 text-xs text-amber-100/55">{map.chapterTitle} · {map.sourcebookTitle}</p>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-amber-100/50">
                        {map.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
                <p className="font-display text-base text-amber-50">No extracted maps yet</p>
                <p className="mt-2 text-sm text-amber-100/55">
                  Linked sourcebooks do not currently expose any extracted kind=&quot;map&quot; images for this campaign.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
