'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function EditNPCPage() {
  const params = useParams();
  const npcId = params.npcId as string;
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const npc = trpc.npcs.getById.useQuery({ id: npcId });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [faction, setFaction] = useState('');
  const [secrets, setSecrets] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!npc.data) return;
    const data = npc.data as any;
    setName(data.name || '');
    setDescription(data.description || '');
    setFaction(data.faction || '');
    setSecrets(data.secrets || '');
    setImageUrl(data.imageUrl || '');
  }, [npc.data]);

  const update = trpc.npcs.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'NPC updated',
        description: 'Changes saved successfully.',
      });
      router.push(`/campaigns/${slug}/npcs/${npcId}`);
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Upload failed',
        description: 'Could not upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: npcId,
      name: name || undefined,
      description: description || undefined,
      faction: faction || undefined,
      secrets: secrets || undefined,
      imageUrl: imageUrl || undefined,
    });
  }

  if (!isDM) {
    return <p className="text-destructive">Only DMs can edit NPCs.</p>;
  }

  if (npc.isLoading) {
    return <Skeleton className="h-96 rounded-lg max-w-2xl" />;
  }

  if (!npc.data) {
    return <p className="text-destructive">NPC not found</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/campaigns/${slug}/npcs/${npcId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Edit NPC</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NPC Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faction">Faction</Label>
              <Input
                id="faction"
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secrets">DM Secrets</Label>
              <Textarea
                id="secrets"
                value={secrets}
                onChange={(e) => setSecrets(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex items-center gap-3">
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
            <div className="flex gap-3">
              <Button type="submit" disabled={update.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {update.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
