'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function NewCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [backstory, setBackstory] = useState('');

  const create = trpc.characters.create.useMutation({
    onSuccess: (data: any) => {
      toast({ title: 'Character created' });
      router.push(`/characters/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="max-w-2xl px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-6">Create Character</h1>
      <Card>
        <CardHeader>
          <CardTitle>Character Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {create.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {create.error.message}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Tharivol Moonwhisper"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Input
                  id="level"
                  type="number"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Input
                  id="race"
                  placeholder="Half-Elf"
                  value={race}
                  onChange={(e) => setRace(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input
                  id="class"
                  placeholder="Wizard"
                  value={charClass}
                  onChange={(e) => setCharClass(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="background">Background</Label>
              <Input
                id="background"
                placeholder="Sage"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea
                id="backstory"
                placeholder="Write your character's backstory..."
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
                {create.isPending ? 'Creating...' : 'Create Character'}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
