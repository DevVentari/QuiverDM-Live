'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Trash2, Save, Eye, EyeOff, Ticket, ExternalLink, Clock, FileText, Map, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const keyConfigs = [
  {
    name: 'openaiApiKey' as const,
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hasField: 'hasOpenaiApiKey' as const,
    maskedField: 'maskedOpenaiApiKey' as const,
  },
  {
    name: 'anthropicApiKey' as const,
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    hasField: 'hasAnthropicApiKey' as const,
    maskedField: 'maskedAnthropicApiKey' as const,
  },
  {
    name: 'huggingfaceToken' as const,
    label: 'Hugging Face Token',
    placeholder: 'hf_...',
    hasField: 'hasHuggingfaceToken' as const,
    maskedField: 'maskedHuggingfaceToken' as const,
  },
  {
    name: 'dndBeyondCobaltCookie' as const,
    label: 'D&D Beyond Cobalt Cookie',
    placeholder: 'Cobalt session cookie',
    hasField: 'hasDndBeyondCobaltCookie' as const,
    maskedField: 'maskedDndBeyondCobaltCookie' as const,
  },
];

/**
 * Format seconds into a human-readable duration string.
 * Examples: "0 min", "45 min", "1 hr 30 min", "10 hr"
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/**
 * Returns the indicator color class based on usage percentage.
 * Normal: default foreground
 * Warning (>80%): amber/orange
 * Critical (>=100%): red
 */
function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage > 80) return 'bg-amber-500';
  return '';
}

/**
 * Returns the text color class based on usage percentage.
 */
function getTextColor(percentage: number): string {
  if (percentage >= 100) return 'text-red-500';
  if (percentage > 80) return 'text-amber-500';
  return 'text-muted-foreground';
}

/**
 * Format tier name for display.
 */
function formatTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Get badge variant based on tier.
 */
function getTierBadgeVariant(tier: string): 'default' | 'secondary' | 'outline' {
  switch (tier) {
    case 'pro': return 'default';
    case 'team': return 'default';
    default: return 'secondary';
  }
}

export default function SettingsPage() {
  const settings = trpc.userSettings.getSettings.useQuery();
  const usage = trpc.usage.getStatus.useQuery();
  const utils = trpc.useUtils();

  const updateKeys = trpc.userSettings.updateApiKeys.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const deleteKey = trpc.userSettings.deleteApiKey.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const [editing, setEditing] = useState<Record<string, string>>({});

  if (settings.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const data = (settings.data || {}) as any;

  function handleSave(keyName: string) {
    updateKeys.mutate({ [keyName]: editing[keyName] });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Usage & Limits Section */}
      {usage.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      ) : usage.data ? (
        <>
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Usage &amp; Limits</CardTitle>
                  <CardDescription>
                    Your current plan and resource usage
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getTierBadgeVariant(usage.data.tier)}>
                    {formatTier(usage.data.tier)} Plan
                  </Badge>
                  {usage.data.tier === 'free' && (
                    <Link href="#">
                      <Button size="sm" variant="outline">
                        Upgrade to Pro
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Usage Meters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Campaigns Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Campaigns</span>
                  </div>
                  {usage.data.campaigns.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {usage.data.campaigns.used} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.campaigns.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.campaigns.percentage)}
                      />
                      <p className={`text-sm ${getTextColor(usage.data.campaigns.percentage)}`}>
                        {usage.data.campaigns.used} of {usage.data.campaigns.limit} used
                      </p>
                    </>
                  )}
                </div>

                {/* Transcription Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Transcription</span>
                  </div>
                  {usage.data.transcription.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(usage.data.transcription.used)} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.transcription.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.transcription.percentage)}
                      />
                      <p className={`text-sm ${getTextColor(usage.data.transcription.percentage)}`}>
                        {formatDuration(usage.data.transcription.used)} of {formatDuration(usage.data.transcription.limit)} used
                      </p>
                    </>
                  )}
                </div>

                {/* PDF Uploads Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">PDF Uploads</span>
                  </div>
                  {usage.data.pdfUploads.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {usage.data.pdfUploads.used} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.pdfUploads.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.pdfUploads.percentage)}
                      />
                      <p className={`text-sm ${getTextColor(usage.data.pdfUploads.percentage)}`}>
                        {usage.data.pdfUploads.used} of {usage.data.pdfUploads.limit} used
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Billing Period */}
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <span>
                  Billing period: {new Date(usage.data.periodStart).toLocaleDateString()} — {new Date(usage.data.periodEnd).toLocaleDateString()}
                </span>
                <span className="mx-2">|</span>
                <span>
                  Resets on {new Date(usage.data.periodEnd).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : usage.isError ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">Failed to load usage data. Please try refreshing the page.</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Configure API keys for AI extraction and integrations.
            Keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {keyConfigs.map((config) => {
            const hasKey = data[config.hasField];
            const masked = data[config.maskedField];
            const isEditing = config.name in editing;

            return (
              <div key={config.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{config.label}</Label>
                  {hasKey && (
                    <Badge variant="secondary" className="text-xs">
                      Configured
                    </Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={config.placeholder}
                      value={editing[config.name]}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [config.name]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={() => handleSave(config.name)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing((prev) => {
                          const next = { ...prev };
                          delete next[config.name];
                          return next;
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {hasKey ? (
                      <>
                        <Input
                          type="text"
                          value={masked || '••••••••'}
                          disabled
                          className="font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing((prev) => ({ ...prev, [config.name]: '' }))
                          }
                        >
                          Change
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteKey.mutate({ keyName: config.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing((prev) => ({ ...prev, [config.name]: '' }))
                        }
                      >
                        Add Key
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Administrative tools and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
            <div className="flex items-center gap-3">
              <Ticket className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Beta Invite Codes</div>
                <div className="text-sm text-muted-foreground">
                  Generate and manage closed beta invite codes
                </div>
              </div>
            </div>
            <Link href="/admin/invites">
              <Button variant="outline" size="sm">
                Manage
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
