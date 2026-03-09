'use client';

import Link from 'next/link';
import { AlertTriangle, Skull } from 'lucide-react';

interface ContinuityWarning {
  type: 'destroyed_referenced' | 'contradictory_update';
  entityId: string;
  entityName: string;
  description: string;
}

interface ContinuityWarningsProps {
  warnings: ContinuityWarning[];
  campaignSlug: string;
}

const WARNING_ICONS = {
  destroyed_referenced: Skull,
  contradictory_update: AlertTriangle,
};

const WARNING_TITLES = {
  destroyed_referenced: 'Destroyed Entity Referenced',
  contradictory_update: 'Contradictory Status Update',
};

export function ContinuityWarnings({ warnings, campaignSlug }: ContinuityWarningsProps) {
  if (warnings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No continuity issues detected.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {warnings.map((warning, i) => {
        const Icon = WARNING_ICONS[warning.type];
        return (
          <li key={`${warning.entityId}-${i}`} className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{WARNING_TITLES[warning.type]}</p>
              <p className="text-xs text-muted-foreground">
                {warning.description}{' '}
                <Link
                  href={`/campaigns/${campaignSlug}/brain/entities/${warning.entityId}`}
                  className="text-primary hover:underline"
                >
                  View entity
                </Link>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
