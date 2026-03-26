'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { PrepScene, PrepNpc, PrepSecret, PrepMonster } from '@/lib/prep-types';

interface SourcebookImportDrawerProps {
  open: boolean;
  onClose: () => void;
  existingSceneCount: number;
  prepNpcs: PrepNpc[];
  prepSecrets: PrepSecret[];
  prepMonsters: PrepMonster[];
  onImport: (scenes: PrepScene[]) => void;
}

export function SourcebookImportDrawer({
  open,
  onClose,
  existingSceneCount,
  prepNpcs,
  prepSecrets,
  prepMonsters,
  onImport,
}: SourcebookImportDrawerProps) {
  const { campaignId } = useCampaign();
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());

  const pdfsQuery = trpc.sourcebookScenes.getAvailablePdfs.useQuery(
    { campaignId },
    { enabled: open }
  );

  const chaptersQuery = trpc.sourcebookScenes.getChapters.useQuery(
    { campaignId, pdfId: selectedPdfId! },
    { enabled: !!selectedPdfId }
  );

  const suggestQuery = trpc.sourcebookScenes.suggestNextChapter.useQuery(
    { campaignId, pdfId: selectedPdfId! },
    { enabled: !!selectedPdfId }
  );

  const chapterScenesQuery = trpc.sourcebookScenes.getByChapter.useQuery(
    { campaignId, pdfId: selectedPdfId!, chapterId: expandedChapterId! },
    { enabled: !!selectedPdfId && !!expandedChapterId }
  );

  useEffect(() => {
    if (pdfsQuery.data && pdfsQuery.data.length > 0 && !selectedPdfId) {
      setSelectedPdfId(pdfsQuery.data[0].id);
    }
  }, [pdfsQuery.data, selectedPdfId]);

  useEffect(() => {
    if (suggestQuery.data && !expandedChapterId) {
      setExpandedChapterId(suggestQuery.data.chapterId);
    }
  }, [suggestQuery.data, expandedChapterId]);

  const toggleScene = (id: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllInChapter = () => {
    if (!chapterScenesQuery.data) return;
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      chapterScenesQuery.data.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleImport = () => {
    if (!chapterScenesQuery.data) return;
    const scenesToImport = chapterScenesQuery.data.filter(s => selectedSceneIds.has(s.id));

    const npcByName = Object.fromEntries(prepNpcs.map(n => [n.name.toLowerCase(), n.id]));

    const newScenes: PrepScene[] = scenesToImport.map((s, i) => ({
      id: crypto.randomUUID(),
      title: s.title,
      description: (s.description as string | null) ?? '',
      location: (s.location as string | null) ?? '',
      readAloud: (s.readAloud as string | null) ?? '',
      order: existingSceneCount + i,
      sourceId: s.id,
      linkedNpcIds: ((s.linkedNpcs as { name: string }[] | null) ?? [])
        .map(n => npcByName[n.name.toLowerCase()])
        .filter(Boolean) as string[],
      linkedSecretIds: [],
      linkedMonsterNames: ((s.linkedMonsters as { name: string }[] | null) ?? []).map(m => m.name),
    }));

    onImport(newScenes);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            Import from Sourcebook
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {pdfsQuery.isLoading && <Skeleton className="h-8 w-full" />}
          {pdfsQuery.data && pdfsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No sourcebook PDFs found for this campaign. Upload a PDF from the Homebrew page first.
            </p>
          )}
          {pdfsQuery.data && pdfsQuery.data.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Sourcebook</p>
              <div className="flex gap-2 flex-wrap">
                {pdfsQuery.data.map(pdf => (
                  <button
                    key={pdf.id}
                    onClick={() => { setSelectedPdfId(pdf.id); setExpandedChapterId(null); setSelectedSceneIds(new Set()); }}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      selectedPdfId === pdf.id
                        ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                        : 'border-border text-muted-foreground hover:border-amber-400/50'
                    }`}
                  >
                    {pdf.filename}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chaptersQuery.isLoading && <Skeleton className="h-32 w-full" />}
          {chaptersQuery.data?.map(chapter => {
            const isSuggested = suggestQuery.data?.chapterId === chapter.chapterId;
            const isExpanded = expandedChapterId === chapter.chapterId;
            return (
              <div
                key={chapter.chapterId}
                className={`rounded-lg border ${isSuggested ? 'border-amber-400/50' : 'border-border'}`}
              >
                <button
                  onClick={() => setExpandedChapterId(isExpanded ? null : chapter.chapterId)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-sm font-medium flex-1">{chapter.chapterTitle}</span>
                  <span className="text-xs text-muted-foreground">{chapter.sceneCount} scenes</span>
                  {isSuggested && (
                    <span className="text-[10px] text-amber-400 uppercase tracking-wider ml-1">Suggested</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">Select scenes to import:</p>
                      <button onClick={selectAllInChapter} className="text-xs text-amber-400 hover:underline">
                        Select all
                      </button>
                    </div>
                    {chapterScenesQuery.isLoading && <Skeleton className="h-20 w-full" />}
                    {chapterScenesQuery.data?.map(scene => (
                      <label key={scene.id} className="flex items-start gap-2.5 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={selectedSceneIds.has(scene.id)}
                          onChange={() => toggleScene(scene.id)}
                          className="mt-0.5 accent-amber-400"
                        />
                        <div>
                          <p className="text-sm">{scene.title}</p>
                          {scene.location && (
                            <p className="text-xs text-muted-foreground">{scene.location as string}</p>
                          )}
                          {scene.readAloud && (
                            <p className="text-xs italic text-amber-100/60 mt-0.5 line-clamp-2">
                              &ldquo;{scene.readAloud as string}&rdquo;
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {selectedSceneIds.size} scene{selectedSceneIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={selectedSceneIds.size === 0}
              onClick={handleImport}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Import {selectedSceneIds.size > 0 ? selectedSceneIds.size : ''} Scene{selectedSceneIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
