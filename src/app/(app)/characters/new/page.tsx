'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { CreatePageShell } from '@/components/create/create-page-shell';

interface CharacterPreviewProps {
  name: string;
  race: string;
  charClass: string;
  level: number;
  backstory: string;
  portraitUrl: string;
  uploading: boolean;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function CharacterPreview({
  name, race, charClass, level, backstory,
  portraitUrl, uploading, onUploadClick, onFileChange, fileInputRef,
}: CharacterPreviewProps) {
  const subtitle = [race, charClass, level ? `Level ${level}` : null].filter(Boolean).join(' · ');

  return (
    <div className="glass-panel glass-grain rounded-xl overflow-hidden border border-border">
      <label
        className="block relative h-24 w-full cursor-pointer group"
        onClick={onUploadClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {portraitUrl ? (
          <Image src={portraitUrl} alt="Character portrait" fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900 flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            ) : (
              <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/60 mt-1">Upload portrait</p>
              </div>
            )}
          </div>
        )}
        <div className="absolute inset-0 ring-2 ring-primary/0 group-hover:ring-primary/30 transition-all rounded-t-xl pointer-events-none" />
      </label>
      <div className="p-4 space-y-1">
        <h3 className="font-display text-base font-bold truncate">
          {name || <span className="text-muted-foreground/40">Your Character</span>}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {backstory && (
          <p className="text-sm text-muted-foreground/70 line-clamp-2 pt-1">{backstory}</p>
        )}
      </div>
    </div>
  );
}

export default function NewCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [backstory, setBackstory] = useState('');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const create = trpc.characters.create.useMutation({
    onSuccess: async (data) => {
      await utils.characters.getMyCharacters.invalidate();
      router.push(`/characters/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/character-portrait', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setPortraitUrl(data.url);
      } else {
        setUploadError(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    create.mutate({
      name,
      race: race || undefined,
      class: charClass || undefined,
      level,
      background: background || undefined,
      backstory: backstory || undefined,
    });
  }

  return (
    <CreatePageShell
      overline="Create"
      title="New Character"
      preview={
        <CharacterPreview
          name={name}
          race={race}
          charClass={charClass}
          level={level}
          backstory={backstory}
          portraitUrl={portraitUrl}
          uploading={uploading}
          onUploadClick={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
          {/* Identity */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Identity</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Tharivol Moonwhisper"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(null); }}
                aria-invalid={!!nameError}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Input id="race" placeholder="Half-Elf" value={race} onChange={(e) => setRace(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input id="class" placeholder="Wizard" value={charClass} onChange={(e) => setCharClass(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-24"
              />
            </div>
          </div>

          {/* Background */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Background</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="background">Background</Label>
              <Input id="background" placeholder="Sage" value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>
          </div>

          {/* Backstory */}
          <div className="space-y-4">
            <div>
              <p className="label-overline mb-1">Backstory</p>
              <div className="section-rule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea
                id="backstory"
                placeholder="Write your character's backstory..."
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {create.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {create.error.message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="default" disabled={create.isPending}>
              {create.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                'Create Character'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </CreatePageShell>
  );
}
