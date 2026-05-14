'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PrepImportZone } from './prep-import-zone';
import type { SessionPrepData } from '@/lib/prep-types';

interface PrepImportButtonProps {
  sessionId: string;
  campaignId: string;
  lastImportedAt?: string;
  onExtracted: (data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) => void;
}

export function PrepImportButton({
  sessionId,
  campaignId,
  lastImportedAt,
  onExtracted,
}: PrepImportButtonProps) {
  const [open, setOpen] = useState(false);

  function handleExtracted(data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) {
    onExtracted(data, sectionCounts);
    setOpen(false);
  }

  return (
    <>
      <button
        data-testid="prep-import-button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full px-4 py-2 text-[11px] border-b opacity-55 hover:opacity-100 transition-opacity"
        style={{
          color: 'oklch(0.7 0.16 55)',
          borderColor: 'oklch(0.2 0.005 270)',
        }}
      >
        <Plus className="h-3 w-3" />
        Import notes
        {lastImportedAt && (
          <span className="ml-auto text-[10px] opacity-60">
            {new Date(lastImportedAt).toLocaleDateString()}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-lg">
          <SheetHeader>
            <SheetTitle>Import Notes</SheetTitle>
          </SheetHeader>
          <div className="mt-4 px-5" data-testid="prep-import-zone">
            <PrepImportZone
              sessionId={sessionId}
              campaignId={campaignId}
              onExtracted={handleExtracted}
              lastImportedAt={lastImportedAt}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
