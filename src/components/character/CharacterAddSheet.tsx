'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Upload } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
};

export function CharacterAddSheet({ open, onOpenChange, campaignId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [ddbUrl, setDdbUrl] = useState('');

  const addToCampaignActive = trpc.characters.addToCampaignActive.useMutation({
    onSuccess: async () => {
      await utils.characters.getCampaignCharacters.invalidate({ campaignId: campaignId! });
      handleOpenChange(false);
    },
    onError: (err) => {
      toast({ title: 'Added character but failed to join campaign', description: err.message, variant: 'destructive' });
      handleOpenChange(false);
    },
  });

  const importCharacter = trpc.charactersDndBeyond.importCharacter.useMutation({
    onSuccess: async (data) => {
      const char = data.character as { id: string };
      await utils.characters.getMyCharacters.invalidate();
      if (campaignId) {
        addToCampaignActive.mutate({ campaignId, characterId: char.id });
      } else {
        handleOpenChange(false);
        router.push(`/characters/${char.id}`);
      }
    },
  });

  const [name, setName] = useState('');
  const [charClass, setCharClass] = useState('');
  const [race, setRace] = useState('');
  const [level, setLevel] = useState(1);
  const [backstory, setBackstory] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createCharacter = trpc.characters.create.useMutation({
    onSuccess: async (data) => {
      await utils.characters.getMyCharacters.invalidate();
      if (campaignId) {
        addToCampaignActive.mutate({ campaignId, characterId: data.id });
      } else {
        handleOpenChange(false);
        router.push(`/characters/${data.id}`);
      }
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  async function handlePortraitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/character-portrait', { method: 'POST', body: formData });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) setPortraitUrl(data.url);
      else toast({ title: 'Upload failed', description: data.error ?? 'Unknown error', variant: 'destructive' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    createCharacter.mutate({
      name: name.trim(),
      class: charClass || undefined,
      race: race || undefined,
      level,
      backstory: backstory || undefined,
      portraitUrl: portraitUrl || undefined,
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDdbUrl('');
      setName('');
      setCharClass('');
      setRace('');
      setLevel(1);
      setBackstory('');
      setPortraitUrl('');
      setNameError(null);
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display">Add Character</SheetTitle>
        </SheetHeader>

        {/* ── DDB Import ─────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Import from D&D Beyond
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.dndbeyond.com/characters/12345678"
              value={ddbUrl}
              onChange={(e) => setDdbUrl(e.target.value)}
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              onClick={() => importCharacter.mutate({ url: ddbUrl.trim() })}
              disabled={!ddbUrl.trim() || importCharacter.isPending}
            >
              {importCharacter.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : 'Import'}
            </Button>
          </div>
          {importCharacter.error && (
            <p className="text-xs text-destructive">{importCharacter.error.message}</p>
          )}
        </div>

        {/* ── Divider ────────────────────────────────────────── */}
        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-3 text-xs text-muted-foreground">
            or create manually
          </span>
        </div>

        {/* ── Manual Create ──────────────────────────────────── */}
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePortraitChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-lg border border-border bg-white/[0.02] hover:border-white/20 overflow-hidden flex items-center justify-center group"
          >
            {portraitUrl ? (
              <Image src={portraitUrl} alt="Portrait" fill className="object-cover" unoptimized />
            ) : uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70" />
            )}
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="char-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              placeholder="Tharivol Moonwhisper"
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="char-class">Class</Label>
              <Input
                id="char-class"
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                placeholder="Fighter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-race">Race</Label>
              <Input
                id="char-race"
                value={race}
                onChange={(e) => setRace(e.target.value)}
                placeholder="Human"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-level">Level</Label>
            <Input
              id="char-level"
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value))))}
              className="w-24"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-backstory">Backstory</Label>
            <Textarea
              id="char-backstory"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Write your character's backstory…"
              rows={3}
              className="resize-none"
            />
          </div>

          <Button type="submit" className="w-full" disabled={createCharacter.isPending}>
            {createCharacter.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
              : 'Create Character'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
