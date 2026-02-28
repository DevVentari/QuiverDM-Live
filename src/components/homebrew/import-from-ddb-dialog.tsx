'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Globe, Loader2, AlertTriangle } from 'lucide-react';

const CONTENT_TYPES = [
  { value: 'spell', label: 'Spell' },
  { value: 'item', label: 'Magic Item' },
  { value: 'creature', label: 'Creature / Monster' },
  { value: 'feat', label: 'Feat' },
] as const;

/** Extracts the numeric ID from a D&D Beyond URL or returns raw input if already an ID. */
function extractDdbId(input: string): string {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Match the last /12345 or /12345-some-slug pattern in the URL
  const matches = trimmed.match(/\/(\d+)(?:-|\?|\/|$)/g);
  if (matches?.length) return matches[matches.length - 1].replace(/\D/g, '');
  return trimmed;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
  defaultCampaignId?: string;
}

export function ImportFromDDBDialog({ open, onOpenChange, onImported, defaultCampaignId }: Props) {
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);

  const [contentType, setContentType] = useState<string>('spell');
  const [ddbUrl, setDdbUrl] = useState('');
  const [campaignId, setCampaignId] = useState(defaultCampaignId ?? '');
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { enabled: open });
  const hasSavedToken = !!settings.data?.hasDndBeyondCobaltCookie;

  const savedToken = trpc.userSettings.getDecryptedKey.useQuery(
    { keyName: 'dndBeyondCobaltCookie' },
    { enabled: open && hasSavedToken }
  );

  const memberships = trpc.campaigns.getMyMemberships.useQuery(
    undefined,
    { enabled: open, staleTime: 60_000 }
  );

  // Auto-fill token from settings
  useEffect(() => {
    if (savedToken.data && !token) {
      setToken(savedToken.data);
      setConnected(true);
    }
  }, [savedToken.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for duplicate when URL changes
  const ddbId = extractDdbId(ddbUrl);
  const duplicateCheck = trpc.homebrewDndBeyond.checkDuplicateByDnDBeyondId.useQuery(
    { dndBeyondId: ddbId },
    { enabled: connected && ddbId.length > 2 && /^\d+$/.test(ddbId) }
  );

  useEffect(() => {
    if (duplicateCheck.data?.exists && duplicateCheck.data.content) {
      setDuplicate({ id: duplicateCheck.data.content.id, name: duplicateCheck.data.content.name });
    } else {
      setDuplicate(null);
    }
  }, [duplicateCheck.data]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveToken = trpc.userSettings.updateApiKeys.useMutation({
    onSuccess: () => {
      setTokenSaved(true);
      toast({ title: 'Token saved to settings' });
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const importMutation = trpc.homebrewDndBeyond.importHomebrewFromDDB.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: `Imported "${data.content?.name ?? 'Item'}" successfully` });
        onImported?.();
        handleClose();
      }
    },
    onError: (e) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleClose() {
    onOpenChange(false);
    // Reset import fields but keep token/connected state
    setDdbUrl('');
    setCampaignId(defaultCampaignId ?? '');
    setDuplicate(null);
  }

  async function handleTest() {
    setConnected(false);
    setTesting(true);
    try {
      const data = await utils.homebrewDndBeyond.testConnection.fetch({ cobaltToken: token });
      if (data.success) {
        setConnected(true);
        toast({ title: 'Connected to D&D Beyond' });
      } else {
        toast({ title: 'Connection failed', description: data.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Connection error', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  }

  function handleImport() {
    importMutation.mutate({
      cobaltToken: token,
      contentType: contentType as 'spell' | 'item' | 'creature' | 'feat',
      dndBeyondId: ddbId,
      addToCampaignId: campaignId || undefined,
    });
  }

  const canImport = connected && ddbId.length > 0 && /^\d+$/.test(ddbId) && !importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Import from D&D Beyond
          </DialogTitle>
          <DialogDescription>
            Import homebrew spells, items, creatures, and feats from your D&D Beyond library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Token ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cobalt-token">CobaltSession Token</Label>
              {connected && (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="cobalt-token"
                type="password"
                placeholder={hasSavedToken && !token ? '••••••••  (saved)' : 'Paste CobaltSession cookie value'}
                value={token}
                onChange={(e) => { setToken(e.target.value); setConnected(false); }}
                className="font-mono text-xs flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!token || testing}
                className="shrink-0"
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
              </Button>
            </div>

            {connected && !hasSavedToken && !tokenSaved && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground -mt-1"
                onClick={() => saveToken.mutate({ dndBeyondCobaltCookie: token })}
                disabled={saveToken.isPending}
              >
                {saveToken.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save for next time
              </Button>
            )}
            {tokenSaved && (
              <p className="text-xs text-emerald-500">✓ Token saved to your settings</p>
            )}
            {!hasSavedToken && !connected && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Find this in your browser DevTools → Application → Cookies → dndbeyond.com → CobaltSession
              </p>
            )}
          </div>

          {/* ── Import form (shown after connecting) ───────────────── */}
          {connected && (
            <>
              <div className="border-t border-border pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Content Type</Label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {memberships.data && memberships.data.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Add to Campaign</Label>
                      <Select value={campaignId} onValueChange={setCampaignId}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {memberships.data.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ddb-url">D&D Beyond URL or Content ID</Label>
                  <Input
                    id="ddb-url"
                    placeholder="https://www.dndbeyond.com/spells/12345  or  12345"
                    value={ddbUrl}
                    onChange={(e) => setDdbUrl(e.target.value)}
                  />
                  {ddbId && /^\d+$/.test(ddbId) && ddbId !== ddbUrl.trim() && (
                    <p className="text-[11px] text-muted-foreground">ID extracted: {ddbId}</p>
                  )}
                </div>

                {duplicate && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-medium">&quot;{duplicate.name}&quot;</span> is already in your library.
                      Importing again will create a duplicate.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {connected && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={!canImport}>
              {importMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
                : duplicate ? 'Import Anyway' : 'Import'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
