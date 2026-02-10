'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users } from 'lucide-react';

export default function CharactersPage() {
  const characters = trpc.characters.getMyCharacters.useQuery();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Characters</h1>
        <Button asChild>
          <Link href="/characters/new">
            <Plus className="mr-2 h-4 w-4" />
            New Character
          </Link>
        </Button>
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
            <Link key={char.id} href={`/characters/${char.id}`}>
              <Card className="h-full hover:border-foreground/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{char.name}</CardTitle>
                  <CardDescription>
                    {[char.race, char.class, char.level && `Level ${char.level}`]
                      .filter(Boolean)
                      .join(' · ') || 'No details'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {char.backstory && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {char.backstory}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No characters yet.</p>
            <Button asChild>
              <Link href="/characters/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Character
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
