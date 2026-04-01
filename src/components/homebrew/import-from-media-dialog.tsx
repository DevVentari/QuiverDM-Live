'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, CheckCircle2, AlertCircle, X, Paperclip, Send } from 'lucide-react';
import type { ClientMessage, ExtractedItem } from '@/lib/homebrew-chat-helpers';

const CONTENT_TYPES = [
  'item', 'spell', 'creature', 'location', 'faction', 'race',
  'rule', 'adventure', 'npc_concept', 'plot_hook', 'lore', 'note',
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

interface ReviewItem extends ExtractedItem {
  id: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

type Step = 'select' | 'chat' | 'saving' | 'done';

interface ImportFromMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  onSuccess?: () => void;
}

// ── File prep helpers ────────────────────────────────────────────────────────

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip "data:image/jpeg;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function prepareFiles(
  files: File[],
): Promise<{ message: ClientMessage; errors: string[] }> {
  const images: Array<{ base64: string; mimeType: string }> = [];
  const textParts: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      if (IMAGE_TYPES.includes(file.type)) {
        const base64 = await readFileAsBase64(file);
        images.push({ base64, mimeType: file.type });
      } else if (file.type === 'application/pdf') {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/uploads/homebrew-import/prepare', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('PDF conversion failed');
        const { markdown } = (await res.json()) as { markdown: string };
        textParts.push(`--- ${file.name} ---\n${markdown}`);
      } else {
        const text = await readFileAsText(file);
        textParts.push(`--- ${file.name} ---\n${text}`);
      }
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : 'prep failed'}`);
    }
  }

  const successCount = files.length - errors.length;
  const label = successCount === 1 ? 'this file' : `these ${successCount} files`;
  const text = textParts.length > 0
    ? `Please extract all D&D homebrew content from ${label}.\n\n${textParts.join('\n\n')}`
    : `Please extract all D&D homebrew content from ${label}.`;

  return {
    message: { role: 'user', text, images: images.length > 0 ? images : undefined },
    errors,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportFromMediaDialog({
  open,
  onOpenChange,
  campaignId,
  onSuccess,
}: ImportFromMediaDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [apiMessages, setApiMessages] = useState<ClientMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepErrors, setPrepErrors] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [showItems, setShowItems] = useState(false); // mobile items panel toggle

  const fileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: campaigns } = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId ?? '__none__');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function addFiles(newFiles: FileList | File[]) {
    setFiles((prev) => [...prev, ...Array.from(newFiles)].slice(0, MAX_FILES));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, []);

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function reset() {
    setStep('select');
    setFiles([]);
    setApiMessages([]);
    setDisplayMessages([]);
    setItems([]);
    setIsLoading(false);
    setIsPreparing(false);
    setPrepErrors([]);
    setInputText('');
    setSavedCount(0);
    setSaveErrors([]);
    setShowItems(false);
  }

  // ── Chat logic ─────────────────────────────────────────────────────────────

  async function sendToChat(newApiMessages: ClientMessage[]) {
    const loadingId = crypto.randomUUID();
    setIsLoading(true);
    setDisplayMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', text: '...' },
    ]);

    try {
      const res = await fetch('/api/uploads/homebrew-import/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiMessages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chat failed');

      setApiMessages(json.messages as ClientMessage[]);
      setDisplayMessages((prev) =>
        prev.map((m) => (m.id === loadingId ? { ...m, text: json.text as string } : m)),
      );
      setItems(
        (json.items as ExtractedItem[]).map((item) => ({ ...item, id: crypto.randomUUID() })),
      );
    } catch (e) {
      setDisplayMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: `Something went wrong — ${e instanceof Error ? e.message : 'chat failed'}. Try sending your message again.` }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartChat() {
    setStep('chat');
    setIsPreparing(true);

    const { message, errors } = await prepareFiles(files);
    setPrepErrors(errors);
    setIsPreparing(false);

    if (errors.length === files.length) {
      setDisplayMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'All files failed to prepare. Please go back and try again.',
      }]);
      return;
    }

    const userDisplayText =
      files.length === 1 ? `Uploading ${files[0].name}…` : `Uploading ${files.length} files…`;

    setDisplayMessages([{ id: crypto.randomUUID(), role: 'user', text: userDisplayText }]);
    await sendToChat([message]);
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    const userMsg: ClientMessage = { role: 'user', text };
    const newApiMessages = [...apiMessages, userMsg];
    setApiMessages(newApiMessages);
    setDisplayMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text },
    ]);

    if (newApiMessages.length >= 20) {
      // 20-turn warning (each turn = 1 API message pair)
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'This is a long conversation — consider saving what you have and starting a new import for the remaining content.',
        },
      ]);
    }

    await sendToChat(newApiMessages);
  }

  async function handleAddFiles(newFiles: FileList) {
    if (isLoading) return;
    const fileArray = Array.from(newFiles);

    const { message, errors } = await prepareFiles(fileArray);
    if (errors.length) setPrepErrors((prev) => [...prev, ...errors]);

    const userDisplayText =
      fileArray.length === 1 ? `Adding ${fileArray[0].name}…` : `Adding ${fileArray.length} files…`;

    const newApiMessages = [...apiMessages, message];
    setApiMessages(newApiMessages);
    setDisplayMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: userDisplayText },
    ]);

    await sendToChat(newApiMessages);
  }

  async function handleSave() {
    setStep('saving');
    try {
      const res = await fetch('/api/uploads/homebrew-import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ name, type, description, properties }) => ({
            name, type, description, properties, sourceType: 'chat_import',
          })),
          campaignId: selectedCampaignId !== '__none__' ? selectedCampaignId : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErrors([json.error || 'Save failed']);
        setSavedCount(0);
      } else {
        setSavedCount(json.saved as number);
        setSaveErrors(json.errors ?? []);
        if ((json.saved as number) > 0) onSuccess?.();
      }
    } catch (e) {
      setSaveErrors([e instanceof Error ? e.message : 'Save failed']);
      setSavedCount(0);
    }
    setStep('done');
  }

  const isBusy = isLoading || isPreparing || step === 'saving';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isBusy) { onOpenChange(v); if (!v) reset(); }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Photo / Notes</DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Upload images, PDFs, or text files. Photos of handwritten notes are transcribed automatically.'}
            {step === 'chat' && 'Chat with the AI to refine what was extracted. Edit items on the right, then save when ready.'}
            {step === 'saving' && 'Saving items…'}
            {step === 'done' && `Done — ${savedCount} item${savedCount !== 1 ? 's' : ''} saved to your library.`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Main content area ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

          {/* SELECT */}
          {step === 'select' && (
            <div className="overflow-y-auto flex-1 space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Images (JPG, PNG, WebP), PDF, text — up to {MAX_FILES} files, 10MB each
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />

              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      {f.size > MAX_FILE_SIZE && (
                        <span className="text-destructive text-xs">too large</span>
                      )}
                      <button
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!campaignId && campaigns && campaigns.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Add to Campaign (optional)</Label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No campaign — library only" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No campaign — library only</SelectItem>
                      {campaigns.map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleStartChat}
                  disabled={files.length === 0 || files.some((f) => f.size > MAX_FILE_SIZE)}
                >
                  Start Chat
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* CHAT */}
          {step === 'chat' && (
            <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
              {/* Left: message history */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {isPreparing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing files…
                    </div>
                  )}
                  {prepErrors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                  {displayMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-amber-500/10 border border-amber-500/20 text-foreground'
                            : 'bg-card text-foreground'
                        }`}
                      >
                        {msg.text === '...' ? (
                          <span className="flex gap-1 py-1">
                            <span className="animate-bounce text-muted-foreground">•</span>
                            <span className="animate-bounce text-muted-foreground [animation-delay:0.15s]">•</span>
                            <span className="animate-bounce text-muted-foreground [animation-delay:0.3s]">•</span>
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Right: items panel (hidden on mobile) */}
              <div className="hidden sm:flex w-60 flex-col shrink-0 border-l pl-4 overflow-y-auto">
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3">
                  Extracted ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing yet — the AI will populate this as you chat.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="space-y-1 p-2 rounded-md bg-card border border-border/50"
                      >
                        <div className="flex gap-1 items-center">
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            className="h-6 text-xs flex-1 px-1.5"
                          />
                          <button
                            onClick={() => deleteItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <Select
                          value={item.type}
                          onValueChange={(v) => updateItem(item.id, { type: v })}
                        >
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAVING */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Saving {items.length} items…</p>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {savedCount > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                )}
                <span>{savedCount} item{savedCount !== 1 ? 's' : ''} saved to your library.</span>
              </div>
              {saveErrors.length > 0 && (
                <ul className="pl-7 text-xs text-destructive space-y-0.5">
                  {saveErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ── Footers ── */}

        {/* Mobile items toggle (sm and below) */}
        {step === 'chat' && items.length > 0 && (
          <div className="sm:hidden border-t pt-2 shrink-0">
            <button
              className="text-xs text-amber-500 font-medium"
              onClick={() => setShowItems((v) => !v)}
            >
              {showItems ? 'Hide' : 'Show'} extracted items ({items.length})
            </button>
            {showItems && (
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground">{item.type}</span>
                    <button onClick={() => deleteItem(item.id)}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat input + actions */}
        {step === 'chat' && (
          <div className="border-t pt-3 space-y-2 shrink-0">
            <div className="flex gap-2 items-center">
              <input
                ref={addFileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={() => addFileRef.current?.click()}
                disabled={isLoading || isPreparing}
                title="Add more files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Type a message…"
                disabled={isLoading || isPreparing}
                className="flex-1"
              />
              <Button
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading || isPreparing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={items.length === 0}>
                Save {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : ''}
              </Button>
              <Button variant="outline" onClick={reset} disabled={isBusy}>
                Start over
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex gap-2 pt-4 border-t shrink-0">
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            <Button variant="outline" onClick={reset}>Import More</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
