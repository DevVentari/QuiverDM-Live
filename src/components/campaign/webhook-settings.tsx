'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Send, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ALL_EVENTS = [
  'session.started',
  'session.ended',
  'summary.ready',
  'encounter.logged',
] as const;

interface WebhookSettingsProps {
  campaignId: string;
}

export function WebhookSettings({ campaignId }: WebhookSettingsProps) {
  const utils = trpc.useUtils();
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'session.started',
    'session.ended',
  ]);

  const endpointsQuery = trpc.webhooks.list.useQuery({ campaignId });

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      void utils.webhooks.list.invalidate({ campaignId });
      setUrl('');
      toast.success('Webhook created');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      void utils.webhooks.list.invalidate({ campaignId });
      toast.success('Webhook deleted');
    },
    onError: (error) => toast.error(error.message),
  });

  const testMutation = trpc.webhooks.testPing.useMutation({
    onSuccess: () => toast.success('Test ping queued'),
    onError: (error) => toast.error(error.message),
  });

  const origin = useMemo(
    () => (typeof window === 'undefined' ? '' : window.location.origin),
    []
  );
  const icalUrl = `${origin}/api/calendar/${campaignId}`;
  const overlayUrl = `${origin}/overlay/${campaignId}`;

  function toggleEvent(event: string) {
    setSelectedEvents((previous) =>
      previous.includes(event)
        ? previous.filter((value) => value !== event)
        : [...previous, event]
    );
  }

  function copyValue(value: string, label: string) {
    void navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks and Integrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-semibold">Outbound Webhooks</h3>
          <div className="space-y-2">
            {endpointsQuery.data?.map((endpoint) => (
              <Card key={endpoint.id}>
                <CardContent className="flex items-center justify-between gap-2 pb-3 pt-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{endpoint.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.isArray(endpoint.events) &&
                        endpoint.events.map((event) => (
                          <Badge key={String(event)} variant="outline" className="text-xs">
                            {String(event)}
                          </Badge>
                        ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => testMutation.mutate({ endpointId: endpoint.id })}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => deleteMutation.mutate({ endpointId: endpoint.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {endpointsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No webhooks configured.</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <Input
              placeholder="https://your-server.com/webhook"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {ALL_EVENTS.map((eventName) => (
                <label key={eventName} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(eventName)}
                    onChange={() => toggleEvent(eventName)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{eventName}</span>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() =>
                createMutation.mutate({
                  campaignId,
                  url,
                  events: selectedEvents as (typeof ALL_EVENTS)[number][],
                })
              }
              disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Webhook
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Integrations</h3>
          <div className="space-y-2">
            <Label>iCal Feed</Label>
            <div className="flex items-center gap-2">
              <Input value={icalUrl} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => copyValue(icalUrl, 'iCal URL')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>OBS Overlay URL</Label>
            <div className="flex items-center gap-2">
              <Input value={overlayUrl} readOnly className="font-mono text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyValue(overlayUrl, 'Overlay URL')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

