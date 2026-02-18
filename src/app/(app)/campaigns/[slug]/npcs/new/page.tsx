'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function NewNPCPage() {
  const router = useRouter();
  const { campaignId, slug } = useCampaign();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const create = trpc.npcs.create.useMutation({
    onSuccess: (data: any) => {
      toast({ title: 'NPC created' });
      router.push(`/campaigns/${slug}/npcs/${data.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);

      const res = await fetch('/api/upload/npc-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      campaignId,
      name,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
    });
  }

  return (
    <div className="max-w-2xl px-4 sm:px-6 lg:px-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6">Create NPC</h2>
      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {create.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {create.error.message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Strahd von Zarovich"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faction">Faction</Label>
              <Input
                id="faction"
                placeholder="Castle Ravenloft"
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A pale figure with piercing eyes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secrets">DM Secrets</Label>
              <Textarea
                id="secrets"
                placeholder="Hidden motivations, secret weaknesses..."
                value={secrets}
                onChange={(e) => setSecrets(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </Button>
                {imageUrl && (
                  <img src={imageUrl} alt={name ? `${name} portrait preview` : "NPC portrait preview"} className="h-12 w-12 rounded object-cover" />
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
                {create.isPending ? 'Creating...' : 'Create NPC'}
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
