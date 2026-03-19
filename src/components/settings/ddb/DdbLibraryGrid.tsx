'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Library } from 'lucide-react';
import { DdbImportModal } from './DdbImportModal';
import { DdbSourcebookDrawer } from './DdbSourcebookDrawer';

export function DdbLibraryGrid() {
  const [showDisclosure, setShowDisclosure] = useState(true);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState<string | null>(null);
  const [selectedSourcebookId, setSelectedSourcebookId] = useState<string | null>(null);

  const { data: entitlements } = trpc.ddbSync.getEntitlements.useQuery();
  const detectMutation = trpc.ddbSync.listEntitlements.useMutation();
  const utils = trpc.useUtils();

  async function handleDetect() {
    await detectMutation.mutateAsync();
    utils.ddbSync.getEntitlements.invalidate();
  }

  return (
    <div className="space-y-6">
      {showDisclosure && (
        <Alert className="border-amber-900/30 bg-amber-950/20">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              We&apos;ll read your D&D Beyond library to show which sourcebooks you can import.
              We store basic metadata (title and cover) — no purchase details or account information.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowDisclosure(false)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={handleDetect} disabled={detectMutation.isPending} variant="outline" className="border-amber-800/40">
        {detectMutation.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Detecting library...</>
          : <><Library className="w-4 h-4 mr-2" />Detect My Library</>}
      </Button>

      {detectMutation.isError && (
        <p className="text-sm text-destructive">{detectMutation.error.message}</p>
      )}

      {entitlements && entitlements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {entitlements.map(e => (
            <div
              key={e.id}
              className="relative rounded border border-amber-900/30 bg-card overflow-hidden cursor-pointer hover:border-amber-600/50 transition-colors"
              onClick={() => e.sourcebook ? setSelectedSourcebookId(e.sourcebook.id) : setSelectedEntitlementId(e.id)}
            >
              {e.coverImageUrl && <img src={e.coverImageUrl} alt={e.title} className="w-full aspect-[2/3] object-cover" />}
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium leading-tight">{e.title}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs capitalize">{e.accessType}</Badge>
                  {e.sourcebook
                    ? <Badge className="text-xs bg-amber-900/50 text-amber-300">Synced</Badge>
                    : <Badge variant="secondary" className="text-xs">Import</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!entitlements?.length && (
        <p className="text-sm text-muted-foreground">No sourcebooks detected yet. Click &quot;Detect My Library&quot; to scan your D&D Beyond account.</p>
      )}

      {selectedEntitlementId && (
        <DdbImportModal
          entitlementId={selectedEntitlementId}
          onClose={() => setSelectedEntitlementId(null)}
          onImported={() => { setSelectedEntitlementId(null); utils.ddbSync.getEntitlements.invalidate(); }}
        />
      )}
      {selectedSourcebookId && (
        <DdbSourcebookDrawer sourcebookId={selectedSourcebookId} onClose={() => setSelectedSourcebookId(null)} />
      )}
    </div>
  );
}
