'use client';

import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SIReviewSheet, type SIExtractedPreview } from './si-review-sheet';

interface IntentBrief {
  toneKeywords: string[];
  playerGoals: string[];
  dmOnlyTruths: string[];
}

interface BriefPanelProps {
  campaignId: string;
  sessionId: string;
  intentBrief?: IntentBrief | null;
}

type ImportState = 'idle' | 'extracting' | 'reviewing' | 'done';

export function BriefPanel({ campaignId, sessionId, intentBrief }: BriefPanelProps) {
  const [prepBrief, setPrepBrief] = useState<string | null>(null);
  const [postSummary, setPostSummary] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [showImportZone, setShowImportZone] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [importError, setImportError] = useState('');
  const [extracted, setExtracted] = useState<SIExtractedPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const generatePrep = trpc.sessions.generatePrepBrief.useMutation({
    onSuccess: (data) => setPrepBrief(data.brief),
  });

  const generatePost = trpc.sessions.generatePostSessionSummary.useMutation({
    onSuccess: (data) => setPostSummary(data.summary),
  });

  const extractDoc = trpc.sessions.extractSIPrepDoc.useMutation({
    onSuccess: (data) => {
      setExtracted(data as SIExtractedPreview);
      setImportState('reviewing');
      setShowImportZone(false);
    },
    onError: (err) => {
      setImportError(err.message);
      setImportState('idle');
    },
  });

  async function handleFile(file: File) {
    try {
      setImportState('extracting');
      setImportError('');
      const text = await file.text();
      extractDoc.mutate({ campaignId, sessionId, text });
    } catch {
      setImportError('Could not read file.');
      setImportState('idle');
    }
  }

  function handlePaste() {
    if (!pastedText.trim()) return;
    setImportState('extracting');
    setImportError('');
    extractDoc.mutate({ campaignId, sessionId, text: pastedText });
  }

  function resetImport() {
    setImportState('done');
    setPastedText('');
    setExtracted(null);
  }

  return (
    <div className="space-y-3 p-3">
      {intentBrief ? (
        <>
          {intentBrief.toneKeywords.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tone</p>
              <div className="flex flex-wrap gap-1">
                {intentBrief.toneKeywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {intentBrief.playerGoals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Players leave with
              </p>
              <ul className="space-y-0.5">
                {intentBrief.playerGoals.map((goal, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intentBrief.dmOnlyTruths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">DM only</p>
              <ul className="space-y-0.5">
                {intentBrief.dmOnlyTruths.map((truth, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                    {truth}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No intent brief set. Add one in session prep.</p>
      )}

      <div className="pt-1 border-t border-border space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePrep.isPending}
          onClick={() => generatePrep.mutate({ campaignId, sessionId })}
        >
          {generatePrep.isPending ? 'Generating...' : 'Generate prep brief'}
        </Button>

        {prepBrief && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {prepBrief}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePost.isPending}
          onClick={() => generatePost.mutate({ campaignId, sessionId })}
        >
          {generatePost.isPending ? 'Generating...' : 'Post-session summary'}
        </Button>

        {postSummary && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {postSummary}
          </p>
        )}

        {/* Import from doc */}
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs h-7 text-muted-foreground"
          onClick={() => setShowImportZone((v) => !v)}
        >
          {importState === 'done' ? 'Re-import from doc' : 'Import from doc'}
        </Button>

        {showImportZone && importState !== 'extracting' && (
          <div className="space-y-2 rounded border border-dashed border-border/40 p-3">
            <div
              className="flex flex-col items-center gap-1.5 py-4 rounded border border-dashed border-border/30 cursor-pointer hover:border-border/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                Upload a text file (.txt, .md) or{' '}
                <span className="text-amber-400/80">browse</span>
              </p>
              <p className="text-[10px] text-muted-foreground/50">For PDFs, copy-paste the text below</p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] text-muted-foreground">or paste</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <Textarea
              placeholder="Paste prep notes…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={4}
              className="resize-none text-xs"
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowImportZone(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs"
                disabled={!pastedText.trim()}
                onClick={handlePaste}
              >
                Extract
              </Button>
            </div>
          </div>
        )}

        {importState === 'extracting' && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Extracting prep content…
          </div>
        )}
      </div>

      {extracted && (
        <SIReviewSheet
          open={importState === 'reviewing'}
          onOpenChange={(open) => {
            if (!open) setImportState('idle');
          }}
          campaignId={campaignId}
          sessionId={sessionId}
          extracted={extracted}
          onConfirmed={resetImport}
        />
      )}
    </div>
  );
}
