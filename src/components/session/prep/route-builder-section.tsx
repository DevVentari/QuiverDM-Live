'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';

interface Route {
  id?: string;
  name: string;
  description: string;
  benefits: string[];
  risks: string[];
  orderIndex: number;
}

interface RouteBuilderSectionProps {
  campaignId: string;
  sessionId: string;
}

export function RouteBuilderSection({ campaignId, sessionId }: RouteBuilderSectionProps) {
  const { data: saved } = trpc.sessionRoutes.list.useQuery({ campaignId, sessionId });
  const [routes, setRoutes] = useState<Route[]>([]);
  const [dirty, setDirty] = useState(false);
  const [benefitInputs, setBenefitInputs] = useState<Record<number, string>>({});
  const [riskInputs, setRiskInputs] = useState<Record<number, string>>({});
  const save = trpc.sessionRoutes.upsertMany.useMutation({ onSuccess: () => setDirty(false) });

  useEffect(() => {
    if (saved) {
      setRoutes(saved.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        benefits: r.benefits,
        risks: r.risks,
        orderIndex: r.orderIndex,
      })));
    }
  }, [saved]);

  function addRoute() {
    setRoutes(prev => [...prev, { name: '', description: '', benefits: [], risks: [], orderIndex: prev.length }]);
    setDirty(true);
  }

  function removeRoute(i: number) {
    setRoutes(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, orderIndex: idx })));
    setDirty(true);
  }

  function updateRoute(i: number, field: keyof Route, value: unknown) {
    setRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    setDirty(true);
  }

  function addChip(i: number, field: 'benefits' | 'risks', value: string) {
    if (!value.trim()) return;
    updateRoute(i, field, [...routes[i][field], value.trim()]);
    if (field === 'benefits') {
      setBenefitInputs(p => ({ ...p, [i]: '' }));
    } else {
      setRiskInputs(p => ({ ...p, [i]: '' }));
    }
  }

  function removeChip(i: number, field: 'benefits' | 'risks', chip: string) {
    updateRoute(i, field, routes[i][field].filter(c => c !== chip));
  }

  return (
    <div className="space-y-4">
      {routes.map((route, i) => (
        <div key={i} className="p-3 rounded-md border border-border/50 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Route name"
              value={route.name}
              onChange={e => updateRoute(i, 'name', e.target.value)}
              className="flex-1 h-8 text-sm font-medium"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRoute(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            placeholder="Description (optional)"
            value={route.description}
            onChange={e => updateRoute(i, 'description', e.target.value)}
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-green-400 mb-1">Benefits</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {route.benefits.map(b => (
                  <Badge
                    key={b}
                    variant="outline"
                    className="text-xs border-green-800 gap-1 cursor-pointer"
                    onClick={() => removeChip(i, 'benefits', b)}
                  >
                    {b} <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add benefit, Enter"
                value={benefitInputs[i] ?? ''}
                onChange={e => setBenefitInputs(p => ({ ...p, [i]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChip(i, 'benefits', benefitInputs[i] ?? '');
                  }
                }}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <p className="text-xs text-red-400 mb-1">Risks</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {route.risks.map(r => (
                  <Badge
                    key={r}
                    variant="outline"
                    className="text-xs border-red-900 gap-1 cursor-pointer"
                    onClick={() => removeChip(i, 'risks', r)}
                  >
                    {r} <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add risk, Enter"
                value={riskInputs[i] ?? ''}
                onChange={e => setRiskInputs(p => ({ ...p, [i]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChip(i, 'risks', riskInputs[i] ?? '');
                  }
                }}
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2" onClick={addRoute}>
          <Plus className="h-3.5 w-3.5" /> Add route
        </Button>
        {dirty && (
          <Button
            size="sm"
            onClick={() => save.mutate({ campaignId, sessionId, routes })}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save routes'}
          </Button>
        )}
      </div>
    </div>
  );
}
