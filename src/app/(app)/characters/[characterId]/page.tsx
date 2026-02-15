'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Trash2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const characterId = params.characterId as string;

  const character = trpc.characters.getById.useQuery({ id: characterId });
  const utils = trpc.useUtils();

  const update = trpc.characters.update.useMutation({
    onSuccess: () => utils.characters.getById.invalidate({ id: characterId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteChar = trpc.characters.delete.useMutation({
    onSuccess: () => router.push('/characters'),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const [form, setForm] = useState({
    name: '',
    race: '',
    class: '',
    level: 1,
    background: '',
    backstory: '',
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
  });

  useEffect(() => {
    if (character.data) {
      const d = character.data as any;
      setForm({
        name: d.name || '',
        race: d.race || '',
        class: d.class || '',
        level: d.level || 1,
        background: d.background || '',
        backstory: d.backstory || '',
        personalityTraits: d.personalityTraits || '',
        ideals: d.ideals || '',
        bonds: d.bonds || '',
        flaws: d.flaws || '',
      });
    }
  }, [character.data]);

  if (character.isLoading) {
    return <Skeleton className="h-96 rounded-lg max-w-2xl" />;
  }

  if (character.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{character.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => character.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!character.data) {
    return <p className="text-destructive">Character not found</p>;
  }

  const data = character.data as any;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: characterId,
      name: form.name,
      race: form.race || undefined,
      class: form.class || undefined,
      level: form.level,
      background: form.background || undefined,
      backstory: form.backstory || null,
      personalityTraits: form.personalityTraits || null,
      ideals: form.ideals || null,
      bonds: form.bonds || null,
      flaws: form.flaws || null,
    });
  }

  return (
    <div className="max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/characters">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold flex-1">{data.name}</h1>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm('Delete this character?')) {
              deleteChar.mutate({ id: characterId });
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Ability Scores */}
      {data.abilityScores && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ability Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-sm">
              {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((ability) => {
                const key = ability.toLowerCase();
                const score = (data.abilityScores as any)?.[key] ?? '—';
                const mod = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0;
                return (
                  <div key={ability}>
                    <div className="font-semibold text-xs text-muted-foreground">{ability}</div>
                    <div className="text-lg font-bold">{score}</div>
                    <div className="text-xs text-muted-foreground">
                      {typeof score === 'number' ? `(${mod >= 0 ? '+' : ''}${mod})` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Edit Character</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Race</Label>
                <Input
                  value={form.race}
                  onChange={(e) => setForm({ ...form, race: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Input
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              <Input
                value={form.background}
                onChange={(e) => setForm({ ...form, background: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Backstory</Label>
              <Textarea
                value={form.backstory}
                onChange={(e) => setForm({ ...form, backstory: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Personality Traits</Label>
                <Textarea
                  value={form.personalityTraits}
                  onChange={(e) => setForm({ ...form, personalityTraits: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Ideals</Label>
                <Textarea
                  value={form.ideals}
                  onChange={(e) => setForm({ ...form, ideals: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bonds</Label>
                <Textarea
                  value={form.bonds}
                  onChange={(e) => setForm({ ...form, bonds: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Flaws</Label>
                <Textarea
                  value={form.flaws}
                  onChange={(e) => setForm({ ...form, flaws: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" />
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
