'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  entitlementId: string;
  onClose: () => void;
  onImported: () => void;
}

export function DdbImportModal({ entitlementId, onClose, onImported }: Props) {
  const { data: campaigns } = trpc.campaigns.getAll.useQuery();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const importMutation = trpc.ddbSync.importSourcebook.useMutation();

  useEffect(() => {
    if (campaigns) setSelectedIds(campaigns.map((c: any) => c.id));
  }, [campaigns]);

  function toggleCampaign(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleImport() {
    await importMutation.mutateAsync({ entitlementId, campaignIds: selectedIds });
    onImported();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-amber-400">Import Sourcebook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select campaigns to seed this content into:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {campaigns?.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3">
                <Checkbox id={c.id} checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleCampaign(c.id)} />
                <Label htmlFor={c.id}>{c.name}</Label>
              </div>
            ))}
          </div>
          {importMutation.isError && <p className="text-sm text-destructive">{importMutation.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.length === 0 || importMutation.isPending}
            className="bg-amber-700 hover:bg-amber-600"
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
