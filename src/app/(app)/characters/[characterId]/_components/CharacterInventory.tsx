'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Backpack, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const RARITY_COLORS: Record<string, string> = {
  Common: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Uncommon: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Rare: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'Very Rare': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  Legendary: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Artifact: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

type CharacterInventoryProps = {
  data: any;
  onUpdate?: (patch: any) => Promise<void>;
  isUpdating?: boolean;
};

export function CharacterInventory({ data, onUpdate, isUpdating }: CharacterInventoryProps) {
  const inventory = data.inventory as any[] | null;
  const currency = data.currency as any;

  const [editingCurrency, setEditingCurrency] = useState(
    currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
  );

  if (!inventory?.length && !currency) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Backpack className="h-8 w-8 mb-2" />
        <p>No inventory</p>
      </div>
    );
  }

  const attunedCount = inventory?.filter((i) => i.attuned).length ?? 0;
  const totalGold = currency
    ? currency.pp * 10 + currency.gp + currency.ep * 0.5 + currency.sp * 0.1 + currency.cp * 0.01
    : 0;

  const sorted = [...(inventory || [])].sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    if (a.attuned !== b.attuned) return a.attuned ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="space-y-6">
      {currency && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: 'PP', key: 'pp', color: 'text-gray-400' },
                { label: 'GP', key: 'gp', color: 'text-yellow-500' },
                { label: 'EP', key: 'ep', color: 'text-blue-400' },
                { label: 'SP', key: 'sp', color: 'text-gray-500' },
                { label: 'CP', key: 'cp', color: 'text-orange-600' },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className={`text-xs font-semibold ${c.color}`}>{c.label}</div>
                  <Input
                    type="number"
                    min={0}
                    disabled={isUpdating}
                    value={Number(editingCurrency[c.key] ?? 0)}
                    onChange={(e) =>
                      setEditingCurrency((prev: any) => ({
                        ...prev,
                        [c.key]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-center"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Total: {totalGold.toFixed(1)} GP equivalent
              </div>
              <Button
                size="sm"
                disabled={isUpdating}
                onClick={() => onUpdate?.({ currency: editingCurrency })}
              >
                Save Currency
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {inventory && inventory.some((i) => i.attuned) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Attunement Slots:</span>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full border ${
                  i < attunedCount ? 'bg-primary border-primary' : 'bg-muted border-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{attunedCount}/3</span>
        </div>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Equipment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-center w-12">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">Rarity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((item: any, idx: number) => (
                    <AccordionItem key={`${item.name}-${idx}`} value={`${item.name}-${idx}`} asChild>
                      <>
                        <TableRow className="cursor-pointer">
                          <TableCell>
                            <AccordionTrigger className="py-0 hover:no-underline [&>svg]:h-3 [&>svg]:w-3">
                              <span className="text-sm font-medium">{item.name}</span>
                            </AccordionTrigger>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {item.type || '-'}
                          </TableCell>
                          <TableCell className="text-center text-xs">{item.quantity}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {item.rarity && item.rarity !== 'Common' && (
                              <Badge className={`text-xs ${RARITY_COLORS[item.rarity] || ''}`} variant="outline">
                                {item.rarity}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {item.equipped && (
                                <Badge variant="default" className="text-xs">
                                  Equipped
                                </Badge>
                              )}
                              {item.attuned && (
                                <Badge variant="secondary" className="text-xs">
                                  Attuned
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        <tr>
                          <td colSpan={5} className="p-0">
                            <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                              <div className="space-y-1.5 pt-1">
                                {item.damage && (
                                  <div>
                                    <span className="font-medium text-foreground">Damage:</span> {item.damage}
                                    {item.damageType && ` ${item.damageType}`}
                                    {item.magicBonus ? ` (+${item.magicBonus})` : ''}
                                  </div>
                                )}
                                {item.attackType && (
                                  <div>
                                    <span className="font-medium text-foreground">Attack:</span> {item.attackType}
                                  </div>
                                )}
                                {item.armorClassBonus != null && (
                                  <div>
                                    <span className="font-medium text-foreground">AC:</span> {item.armorClassBonus}
                                  </div>
                                )}
                                {item.properties?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.properties.map((p: string) => (
                                      <Badge key={p} variant="outline" className="text-xs">
                                        {p}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {item.charges && (
                                  <div className="flex items-center gap-2">
                                    <span>
                                      <span className="font-medium text-foreground">Charges:</span>{' '}
                                      {item.charges.current}/{item.charges.max}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7"
                                      disabled={isUpdating || item.charges.current <= 0}
                                      onClick={async () => {
                                        if (!onUpdate) return;
                                        const next = (inventory || []).map((entry: any) => {
                                          if (entry !== item) return entry;
                                          return {
                                            ...entry,
                                            charges: {
                                              ...entry.charges,
                                              current: Math.max(0, Number(entry.charges.current || 0) - 1),
                                            },
                                          };
                                        });
                                        await onUpdate({ inventory: next });
                                      }}
                                    >
                                      Use
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7"
                                      disabled={isUpdating}
                                      onClick={async () => {
                                        if (!onUpdate) return;
                                        const next = (inventory || []).map((entry: any) => {
                                          if (entry !== item) return entry;
                                          return {
                                            ...entry,
                                            charges: {
                                              ...entry.charges,
                                              current: Number(entry.charges.max || 0),
                                            },
                                          };
                                        });
                                        await onUpdate({ inventory: next });
                                      }}
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Reset
                                    </Button>
                                  </div>
                                )}
                                {item.range && (
                                  <div>
                                    <span className="font-medium text-foreground">Range:</span> {item.range.normal} ft
                                    {item.range.long ? ` / ${item.range.long} ft` : ''}
                                  </div>
                                )}
                                {item.description && (
                                  <p className="leading-relaxed mt-1">{stripHtml(item.description)}</p>
                                )}
                              </div>
                            </AccordionContent>
                          </td>
                        </tr>
                      </>
                    </AccordionItem>
                  ))}
                </TableBody>
              </Table>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

