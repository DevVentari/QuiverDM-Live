'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

type NpcSuggestion = { worldEntityId: string; name: string; score: number };

type ExtractedSecret = {
  name: string;
  content: string;
  isCritical: boolean;
  knowledge: Array<{ entityName: string; worldEntityId?: string; revealCondition?: string }>;
};
type ExtractedPhase = { name: string; targetMinutes: number; notes?: string };
type ExtractedRoute = { name: string; description?: string; isActive: boolean };
type ExtractedNpc = {
  name: string;
  defaultBehavior: string;
  triggeredBehaviors: Array<{ condition: string; behavior: string }>;
  criticalDialogue: Array<{ line: string; trigger: string }>;
  suggestedMatch: NpcSuggestion | null;
};

export type SIExtractedPreview = {
  intentBrief?: string;
  secrets: ExtractedSecret[];
  phases: ExtractedPhase[];
  routes: ExtractedRoute[];
  npcProfiles: ExtractedNpc[];
};

interface SIReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  sessionId: string;
  extracted: SIExtractedPreview;
  onConfirmed: () => void;
}

export function SIReviewSheet({
  open,
  onOpenChange,
  campaignId,
  sessionId,
  extracted,
  onConfirmed,
}: SIReviewSheetProps) {
  const { toast } = useToast();

  const [intentBrief, setIntentBrief] = useState(extracted.intentBrief ?? '');
  const [secrets, setSecrets] = useState(() =>
    extracted.secrets.map((s) => ({ ...s, accepted: true }))
  );
  const [phases, setPhases] = useState(() =>
    extracted.phases.map((p) => ({ ...p, accepted: true }))
  );
  const [routes, setRoutes] = useState(() =>
    extracted.routes.map((r) => ({ ...r, accepted: true }))
  );
  const [npcProfiles, setNpcProfiles] = useState(() =>
    extracted.npcProfiles.map((n) => ({
      ...n,
      accepted: true,
      useMatch: n.suggestedMatch !== null,
    }))
  );

  const confirm = trpc.sessions.confirmSIPrepImport.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Import complete',
        description: `${data.secretsCreated} secrets · ${data.phasesCreated} phases · ${data.routesCreated} routes · ${data.profilesUpserted} NPC profiles`,
      });
      onOpenChange(false);
      onConfirmed();
    },
    onError: () => {
      toast({ title: 'Import failed', variant: 'destructive' });
    },
  });

  const acceptedCount =
    secrets.filter((s) => s.accepted).length +
    phases.filter((p) => p.accepted).length +
    routes.filter((r) => r.accepted).length +
    npcProfiles.filter((n) => n.accepted).length;

  const totalCount =
    extracted.secrets.length +
    extracted.phases.length +
    extracted.routes.length +
    extracted.npcProfiles.length;

  function handleConfirm() {
    confirm.mutate({
      campaignId,
      sessionId,
      intentBrief: intentBrief.trim() || undefined,
      secrets: secrets
        .filter((s) => s.accepted)
        .map(({ accepted: _a, ...s }) => s),
      phases: phases
        .filter((p) => p.accepted)
        .map(({ accepted: _a, ...p }) => p),
      routes: routes
        .filter((r) => r.accepted)
        .map(({ accepted: _a, ...r }) => r),
      npcProfiles: npcProfiles
        .filter((n) => n.accepted)
        .map(({ accepted: _a, useMatch, suggestedMatch, ...n }) => ({
          ...n,
          worldEntityId: useMatch && suggestedMatch ? suggestedMatch.worldEntityId : undefined,
        })),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] max-w-full flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40 shrink-0">
          <SheetTitle className="text-sm">
            Review Import{' '}
            <span className="text-xs text-muted-foreground font-normal">
              — {acceptedCount} of {totalCount} items accepted
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Accordion
            type="multiple"
            defaultValue={['brief', 'secrets', 'phases', 'routes', 'npcs']}
          >
            {/* Intent Brief */}
            <AccordionItem value="brief">
              <AccordionTrigger className="text-xs font-medium">Intent Brief</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={intentBrief}
                  onChange={(e) => setIntentBrief(e.target.value)}
                  placeholder="What is this session about..."
                  rows={4}
                  className="text-xs resize-none"
                />
              </AccordionContent>
            </AccordionItem>

            {/* Secrets */}
            <AccordionItem value="secrets">
              <AccordionTrigger className="text-xs font-medium">
                Secrets{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.secrets.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {secrets.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !s.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={s.name}
                        onChange={(e) =>
                          setSecrets((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Switch
                        checked={s.accepted}
                        onCheckedChange={(v) =>
                          setSecrets((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    <Textarea
                      value={s.content}
                      onChange={(e) =>
                        setSecrets((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, content: e.target.value } : x))
                        )
                      }
                      rows={2}
                      className="text-xs resize-none"
                    />
                    {s.knowledge.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.knowledge.map((k, ki) => (
                          <Badge key={ki} variant="outline" className="text-[10px]">
                            {k.entityName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!secrets.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Phases */}
            <AccordionItem value="phases">
              <AccordionTrigger className="text-xs font-medium">
                Phases{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.phases.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {phases.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !p.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={p.name}
                        onChange={(e) =>
                          setPhases((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        value={p.targetMinutes}
                        onChange={(e) =>
                          setPhases((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? { ...x, targetMinutes: parseInt(e.target.value) || 30 }
                                : x
                            )
                          )
                        }
                        className="h-6 text-xs w-16 text-center"
                        min={1}
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">min</span>
                      <Switch
                        checked={p.accepted}
                        onCheckedChange={(v) =>
                          setPhases((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
                {!phases.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Routes */}
            <AccordionItem value="routes">
              <AccordionTrigger className="text-xs font-medium">
                Routes{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.routes.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {routes.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !r.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={r.name}
                        onChange={(e) =>
                          setRoutes((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="h-6 text-xs flex-1"
                      />
                      <Switch
                        checked={r.accepted}
                        onCheckedChange={(v) =>
                          setRoutes((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                ))}
                {!routes.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* NPCs */}
            <AccordionItem value="npcs">
              <AccordionTrigger className="text-xs font-medium">
                NPCs{' '}
                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                  {extracted.npcProfiles.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {npcProfiles.map((n, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border border-border/40 p-3 space-y-2',
                      !n.accepted && 'opacity-40'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium flex-1">{n.name}</span>
                      <Switch
                        checked={n.accepted}
                        onCheckedChange={(v) =>
                          setNpcProfiles((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, accepted: v } : x))
                          )
                        }
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{n.defaultBehavior}</p>
                    {n.suggestedMatch && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={n.useMatch ? 'default' : 'outline'}
                          className="text-[10px] cursor-pointer"
                          onClick={() =>
                            setNpcProfiles((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, useMatch: !x.useMatch } : x
                              )
                            )
                          }
                        >
                          Link to {n.suggestedMatch.name} (
                          {Math.round(n.suggestedMatch.score * 100)}%)
                        </Badge>
                        {!n.useMatch && (
                          <span className="text-[10px] text-muted-foreground">
                            Will create new entity
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!npcProfiles.length && (
                  <p className="text-xs text-muted-foreground">None extracted</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={confirm.isPending || acceptedCount === 0}
            onClick={handleConfirm}
          >
            {confirm.isPending ? 'Importing...' : 'Confirm Import'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
