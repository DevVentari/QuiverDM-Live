'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pill } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { PrepItem, PrepItemStatus } from '@/lib/prep-types';

interface PrepPlanPanelProps {
  items: PrepItem[];
  onChange: (items: PrepItem[]) => void;
}

const STATUS_ORDER: PrepItemStatus[] = ['planned', 'prepping', 'prepped', 'used', 'dropped'];

const STATUS_META: Record<PrepItemStatus, { label: string; tone: 'quest' | 'primary' | 'success' | 'neutral' | 'danger' }> = {
  planned: { label: 'Planned', tone: 'quest' },
  prepping: { label: 'Prepping', tone: 'primary' },
  prepped: { label: 'Prepped', tone: 'success' },
  used: { label: 'Used', tone: 'neutral' },
  dropped: { label: 'Dropped', tone: 'danger' },
};

function newItemId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `prep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortItems(items: PrepItem[]) {
  return [...items].sort((a, b) => {
    const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
  });
}

export function PrepPlanPanel({ items, onChange }: PrepPlanPanelProps) {
  const [newTitle, setNewTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);

  const sortedItems = useMemo(() => sortItems(items), [items]);
  const selected = sortedItems.find((item) => item.id === selectedId) ?? sortedItems[0] ?? null;

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  function updateItem(updated: PrepItem) {
    onChange(items.map((item) => (item.id === updated.id ? updated : item)));
  }

  function patchItem(id: string, patch: Partial<PrepItem>) {
    const existing = items.find((item) => item.id === id);
    if (!existing) return;
    updateItem({ ...existing, ...patch, updatedAt: new Date().toISOString() });
  }

  function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    const item: PrepItem = {
      id: newItemId(),
      title,
      status: 'planned',
      objective: '',
      notes: '',
      outcome: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onChange([...items, item]);
    setSelectedId(item.id);
    setNewTitle('');
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function setStatus(id: string, status: PrepItemStatus) {
    patchItem(id, { status });
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--q-border-subtle)] bg-black/10 p-3">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.8px] text-[var(--q-accent-primary-dim)]">
            Prep Plan
          </div>
          <div className="mt-1 text-[11px] text-[var(--q-text-faint)]">
            Open a planned item, shape the prep, then mark it ready for the session.
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a prep item"
          className="h-8 border-[var(--q-border-subtle)] bg-transparent text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button size="sm" onClick={addItem} disabled={!newTitle.trim()}>
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--q-border-subtle)] px-3 py-4 text-center text-xs text-[var(--q-text-faint)]">
          Add a plan item to track the work you still need to do.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {sortedItems.map((item) => {
              const meta = STATUS_META[item.status];
              const isSelected = item.id === selected?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'border-[var(--q-accent-primary-border)] bg-white/[0.03]'
                      : 'border-[var(--q-border-subtle)] bg-black/10 hover:bg-white/[0.02]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
                      {item.title}
                    </span>
                    <Pill variant={meta.tone}>{meta.label}</Pill>
                  </div>
                  {item.objective && (
                    <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--q-text-faint)]">
                      {item.objective}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="space-y-3 rounded-xl border border-[var(--q-border-subtle)] bg-[var(--q-bg)]/40 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    value={selected.title}
                    onChange={(e) => patchItem(selected.id, { title: e.target.value })}
                    className="h-9 border-[var(--q-border-subtle)] bg-transparent font-[var(--q-font-display)] text-base"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.status === 'planned' ? 'default' : 'outline'}
                      onClick={() => setStatus(selected.id, 'planned')}
                    >
                      Planned
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.status === 'prepping' ? 'default' : 'outline'}
                      onClick={() => setStatus(selected.id, 'prepping')}
                    >
                      <Play size={14} className="mr-1" />
                      Prep it
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.status === 'prepped' ? 'default' : 'outline'}
                      onClick={() => setStatus(selected.id, 'prepped')}
                    >
                      <CheckCircle2 size={14} className="mr-1" />
                      Prepped
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.status === 'used' ? 'default' : 'outline'}
                      onClick={() => setStatus(selected.id, 'used')}
                    >
                      Used
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.status === 'dropped' ? 'destructive' : 'outline'}
                      onClick={() => setStatus(selected.id, 'dropped')}
                    >
                      Dropped
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    Objective
                  </span>
                  <Textarea
                    value={selected.objective}
                    onChange={(e) => patchItem(selected.id, { objective: e.target.value })}
                    rows={3}
                    placeholder="What does 'done' look like?"
                    className="border-[var(--q-border-subtle)] bg-transparent text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    Prep notes
                  </span>
                  <Textarea
                    value={selected.notes}
                    onChange={(e) => patchItem(selected.id, { notes: e.target.value })}
                    rows={4}
                    placeholder="Scenes, beats, stat blocks, reminders..."
                    className="border-[var(--q-border-subtle)] bg-transparent text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    Outcome
                  </span>
                  <Textarea
                    value={selected.outcome}
                    onChange={(e) => patchItem(selected.id, { outcome: e.target.value })}
                    rows={3}
                    placeholder="What happened when it was used?"
                    className="border-[var(--q-border-subtle)] bg-transparent text-sm"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-[var(--q-text-faint)]">
                  {selected.status === 'planned' && 'Start prepping when you begin working on the item.'}
                  {selected.status === 'prepping' && 'This is the working state. Keep notes here until it is ready.'}
                  {selected.status === 'prepped' && 'Ready for play. Mark it used after the session.'}
                  {selected.status === 'used' && 'This has been spent in play and can stay archived.'}
                  {selected.status === 'dropped' && 'Dropped items stay here for reference, but do not need more prep.'}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(selected.id)}
                  className="text-[var(--q-text-faint)] hover:text-[var(--q-text-danger)]"
                >
                  <Trash2 size={14} className="mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
