'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Plus, Users, Download, RefreshCw, Loader2, ExternalLink, Sword } from 'lucide-react';

export default function CharactersPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importResult, setImportResult] = useState<{
    id: string;
    name: string;
    race?: string | null;
    class?: string | null;
    level?: number | null;
  } | null>(null);

  const importCharacter = trpc.charactersDndBeyond.importCharacter.useMutation({
    onSuccess: async (data) => {
      const imported = data.character as any;
      await utils.characters.getMyCharacters.invalidate();
      setImportResult({
        id: imported.id,
        name: imported.name,
        race: imported.race,
        class: imported.class,
        level: imported.level,
      });
      toast({
        title: data.created ? 'Character imported' : 'Character updated',
        description: data.created
          ? `${imported.name} was imported from D&D Beyond.`
          : `${imported.name} was synced with latest D&D Beyond data.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncCharacter = trpc.charactersDndBeyond.syncCharacter.useMutation({
    onSuccess: async (data) => {
      const synced = data.character as any;
      await utils.characters.getMyCharacters.invalidate();
      toast({
        title: 'Character synced',
        description: `${synced.name} was synced from D&D Beyond.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  function handleImportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImportResult(null);
    importCharacter.mutate({ url: importUrl.trim() });
  }

  return (
    <div className="space-y-6 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">My Characters</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Dialog
            open={importOpen}
            onOpenChange={(open) => {
              setImportOpen(open);
              if (!open) {
                setImportResult(null);
                setImportUrl('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Import from D&D Beyond
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Character</DialogTitle>
                <DialogDescription>
                  Paste your D&D Beyond character URL, for example:
                  https://www.dndbeyond.com/characters/12345678
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dndbeyond-url">Character URL</Label>
                  <Input
                    id="dndbeyond-url"
                    type="url"
                    placeholder="https://www.dndbeyond.com/characters/12345678"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    required
                  />
                </div>

                {importResult && (
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                    <div className="font-medium">Imported: {importResult.name}</div>
                    <div className="text-muted-foreground">
                      {[
                        importResult.race,
                        importResult.class,
                        importResult.level ? `Level ${importResult.level}` : null,
                      ]
                        .filter(Boolean)
                        .join(' | ') || 'No details'}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  {importResult ? (
                    <Button asChild>
                      <Link href={`/characters/${importResult.id}`}>
                        View Character
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button type="submit" disabled={importCharacter.isPending}>
                      {importCharacter.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        'Import Character'
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button asChild>
            <Link href="/characters/new">
              <Plus className="mr-2 h-4 w-4" />
              New Character
            </Link>
          </Button>
        </div>
      </div>

      {characters.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : characters.data && characters.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(characters.data as any[]).map((char) => (
            <Card key={char.id} className="h-full overflow-hidden">
              <div className="flex">
                {char.portraitUrl ? (
                  <div className="relative w-24 shrink-0">
                    <Image
                      src={char.portraitUrl}
                      alt={char.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex w-24 shrink-0 items-center justify-center bg-gradient-to-b from-purple-950 to-blue-950">
                    <Users className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">
                        <Link
                          href={`/characters/${char.id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {char.name}
                        </Link>
                      </CardTitle>
                      {char.dndBeyondId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncCharacter.isPending}
                          onClick={() => syncCharacter.mutate({ characterId: char.id })}
                          title="Sync from D&D Beyond"
                        >
                          {syncCharacter.isPending && syncCharacter.variables?.characterId === char.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      {[char.race, char.class, char.level && `Level ${char.level}`]
                        .filter(Boolean)
                        .join(' | ') || 'No details'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {char.backstory ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {char.backstory}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No backstory added yet.</p>
                    )}
                  </CardContent>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Sword className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No characters yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create a character or import one from D&D Beyond to join campaigns.
            </p>
            <Button asChild size="sm">
              <Link href="/characters/new">
                New Character
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
