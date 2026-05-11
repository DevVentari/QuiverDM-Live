'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, Plus, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export default function AdminInvitesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('generate');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'used' | 'expired'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkExpireDays, setBulkExpireDays] = useState<number | undefined>();
  const [bulkEmails, setBulkEmails] = useState('');

  const { data: stats, refetch: refetchStats } = trpc.invites.getStats.useQuery(undefined, { staleTime: 10_000 });
  const { data: allCodes, refetch: refetchCodes } = trpc.invites.getAll.useQuery(
    { limit: 200 },
    { staleTime: 10_000 },
  );

  const generateSingle = trpc.invites.generate.useMutation({
    onSuccess: (data) => {
      const sentCount = 'emailSent' in data ? data.emailSent : 0;
      const requestedCount = 'emailRequested' in data ? data.emailRequested : 0;
      toast({
        title: 'Code generated',
        description:
          requestedCount > 0
            ? `Generated ${data.codes[0]} and emailed ${sentCount}/${requestedCount}`
            : `Generated ${data.codes[0]}`,
      });
      void refetchStats();
      void refetchCodes();
      setRecentCodes(data.codes);
      setSingleEmail('');
    },
    onError: (error) =>
      toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const generateBulk = trpc.invites.generate.useMutation({
    onSuccess: (data) => {
      const sentCount = 'emailSent' in data ? data.emailSent : 0;
      const requestedCount = 'emailRequested' in data ? data.emailRequested : 0;
      toast({
        title: 'Codes generated',
        description:
          requestedCount > 0
            ? `Generated ${data.created} codes and emailed ${sentCount}/${requestedCount}`
            : `Generated ${data.created} invite codes`,
      });
      void refetchStats();
      void refetchCodes();
      setRecentCodes(data.codes);
      setBulkEmails('');
    },
    onError: (error) =>
      toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const cleanupExpired = trpc.invites.cleanupExpired.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Cleanup complete',
        description: `Deleted ${data.deletedCount} expired codes`,
      });
      void refetchStats();
      void refetchCodes();
    },
    onError: (error) =>
      toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleGenerateSingle = () => {
    generateSingle.mutate({
      count: 1,
      emails: singleEmail.trim() ? [singleEmail.trim()] : undefined,
    });
  };

  const handleGenerateBulk = () => {
    const recipients = bulkEmails
      .split(/[\n,]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (bulkCount < 1 || bulkCount > 1000) {
      toast({
        title: 'Invalid count',
        description: 'Count must be between 1 and 1000',
        variant: 'destructive',
      });
      return;
    }

    if (recipients.length > bulkCount) {
      toast({
        title: 'Too many emails',
        description: 'Recipient count cannot exceed generated code count.',
        variant: 'destructive',
      });
      return;
    }

    generateBulk.mutate({
      count: bulkCount,
      expiresInDays: bulkExpireDays,
      emails: recipients.length > 0 ? recipients : undefined,
    });
  };

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ title: 'Copied', description: `${code} copied to clipboard` });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = async (codes: string[]) => {
    if (codes.length === 0) return;
    await navigator.clipboard.writeText(codes.join('\n'));
    toast({
      title: 'Copied',
      description: `${codes.length} invite code${codes.length === 1 ? '' : 's'} copied to clipboard`,
    });
  };

  const filteredCodes = (allCodes ?? []).filter((code) => {
    const isExpired = !!code.expiresAt && new Date(code.expiresAt) < new Date() && !code.usedBy;

    switch (statusFilter) {
      case 'unused':
        return !code.usedBy && !isExpired;
      case 'used':
        return !!code.usedBy;
      case 'expired':
        return isExpired;
      default:
        return true;
    }
  });

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="stone-card">
        <div className="stone-card-header">
          <div>
            <span className="stone-card-title">Closed Beta Access</span>
            <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
              <Ticket className="h-7 w-7 text-primary" />
              Beta Invite Codes
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate and manage invite codes from the standalone admin console.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList role="tablist">
          <TabsTrigger value="generate" role="tab">
            <Plus className="mr-2 h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="codes" role="tab">
            <Ticket className="mr-2 h-4 w-4" />
            Codes ({allCodes?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-3">
                <CardDescription>Total Codes</CardDescription>
                <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-3">
                <CardDescription>Used</CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats?.used || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-3">
                <CardDescription>Unused</CardDescription>
                <CardTitle className="text-3xl text-blue-600">{stats?.unused || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-3">
                <CardDescription>Expired</CardDescription>
                <CardTitle className="text-3xl text-amber-500">{stats?.expired || 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle>Generate One</CardTitle>
                <CardDescription>Create a single invite code and optionally email it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
                <Button onClick={handleGenerateSingle} disabled={generateSingle.isPending}>
                  {generateSingle.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Generate Code
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle>Generate Batch</CardTitle>
                <CardDescription>Issue multiple codes for a cohort or launch wave.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(Number(e.target.value))}
                    placeholder="Count"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={bulkExpireDays ?? ''}
                    onChange={(e) => setBulkExpireDays(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Expires in days"
                  />
                </div>
                <Textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  rows={6}
                  placeholder="one@example.com, two@example.com"
                />
                <Button onClick={handleGenerateBulk} disabled={generateBulk.isPending}>
                  {generateBulk.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Generate Batch
                </Button>
              </CardContent>
            </Card>
          </div>

          {recentCodes.length > 0 && (
            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle>Recently Generated</CardTitle>
                <CardDescription>Immediate copy surface for the latest issued codes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={() => copyAllCodes(recentCodes)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy All
                </Button>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentCodes.map((code) => (
                    <div key={code} className="rounded-lg border border-border/60 bg-background/40 p-4">
                      <div className="font-mono text-sm font-semibold">{code}</div>
                      <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => copyToClipboard(code)}>
                        {copiedCode === code ? (
                          <>
                            <Check className="mr-2 h-4 w-4 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy code
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/60 bg-card/50">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Refresh or clean up the invite pool.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => { void refetchStats(); void refetchCodes(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </Button>
              <Button
                variant="destructive"
                onClick={() => cleanupExpired.mutate()}
                disabled={cleanupExpired.isPending || (stats?.expired || 0) === 0}
              >
                {cleanupExpired.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Expired ({stats?.expired || 0})
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes">
          <Card className="border-border/60 bg-card/50">
            <CardHeader>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Filter and copy recent codes from the latest 200 records.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
                  All
                </Button>
                <Button variant={statusFilter === 'unused' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('unused')}>
                  Unused
                </Button>
                <Button variant={statusFilter === 'used' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('used')}>
                  Used
                </Button>
                <Button variant={statusFilter === 'expired' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('expired')}>
                  Expired
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyAllCodes(filteredCodes.map((code) => code.code))}
                  disabled={filteredCodes.length === 0}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Visible
                </Button>
              </div>

              {!allCodes || filteredCodes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No codes match this filter.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCodes.map((code) => {
                      const isExpired = !!code.expiresAt && new Date(code.expiresAt) < new Date() && !code.usedBy;
                      const status = code.usedBy ? 'Used' : isExpired ? 'Expired' : 'Unused';

                      return (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                          <TableCell>
                            <Badge variant={status === 'Used' ? 'secondary' : status === 'Expired' ? 'destructive' : 'outline'}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(code.createdAt)}</TableCell>
                          <TableCell>
                            {code.expiresAt ? (
                              <Badge variant={new Date(code.expiresAt) < new Date() && !code.usedBy ? 'destructive' : 'secondary'}>
                                {formatDate(code.expiresAt)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Never</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(code.usedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code.code)} aria-label="Copy invite code">
                              {copiedCode === code.code ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
