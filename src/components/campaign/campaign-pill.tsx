'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Campaign {
  slug: string;
  name: string;
  sessionCount?: number | null;
}

interface CampaignPillProps {
  current: Campaign | null;
  campaigns: Campaign[];
  collapsed: boolean;
}

export function CampaignPill({ current, campaigns, collapsed }: CampaignPillProps) {
  const router = useRouter();

  const trigger = collapsed ? (
    <button
      className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-[3px] border border-[hsl(35_35%_18%)] bg-[hsl(240,10%,10%)] text-muted-foreground/60 transition-colors hover:border-[hsl(35_50%_26%)] hover:text-foreground"
      title={current?.name ?? 'Select campaign'}
    >
      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  ) : (
    <button
      className="mx-3 mb-1 flex w-[calc(100%-24px)] items-center justify-between gap-2 rounded-[3px] border border-[hsl(35_35%_18%)] px-3 py-2 text-left transition-colors hover:border-[hsl(35_50%_26%)]"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08)',
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>
          {current?.name ?? 'Select Campaign'}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'hsl(35 10% 44%)' }}>
          {current ? `${current.sessionCount ?? 0} sessions · switch` : 'No campaign selected'}
        </p>
      </div>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={1.8} />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        {campaigns.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}`)}
            className="gap-2"
          >
            {c.slug === current?.slug
              ? <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              : <span className="w-3.5 shrink-0" />}
            <span className="truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/campaigns')}>
          All campaigns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
