'use client';

import { ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NextLink from 'next/link';
import { cn } from '@/lib/utils';

interface PartyImportStepProps {
  campaignUrl: string;
  onChange: (url: string) => void;
  hasCobalt: boolean;
}

function isValidDdbCampaignUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.dndbeyond.com' || parsed.hostname === 'dndbeyond.com') &&
      parsed.pathname.startsWith('/campaigns/')
    );
  } catch {
    return false;
  }
}

export function PartyImportStep({ campaignUrl, onChange, hasCobalt }: PartyImportStepProps) {
  const isValid = campaignUrl !== '' && isValidDdbCampaignUrl(campaignUrl);
  const isInvalid = campaignUrl !== '' && !isValidDdbCampaignUrl(campaignUrl);

  if (!hasCobalt) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-amber-300 font-medium">D&D Beyond token not configured</p>
            <p className="text-xs text-muted-foreground">
              Add your Cobalt token in Settings to enable D&D Beyond party import.
            </p>
          </div>
        </div>
        <NextLink
          href="/settings/api-keys"
          className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Go to Settings → API Keys
        </NextLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ddb-campaign-url">D&D Beyond Campaign URL</Label>
        <Input
          id="ddb-campaign-url"
          placeholder="https://www.dndbeyond.com/campaigns/12345"
          value={campaignUrl}
          onChange={(e) => onChange(e.target.value)}
          className={cn(isInvalid && 'border-destructive/60')}
        />
        {isInvalid && (
          <p className="text-xs text-destructive">
            Enter a valid D&D Beyond campaign URL (e.g. https://www.dndbeyond.com/campaigns/12345)
          </p>
        )}
        {isValid && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Party will be imported when the campaign is created
          </div>
        )}
      </div>
    </div>
  );
}
