'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Save, Eye, EyeOff } from 'lucide-react';

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

export default function SettingsPage() {
  const settings = trpc.userSettings.getSettings.useQuery();
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
    </div>
  );
}
