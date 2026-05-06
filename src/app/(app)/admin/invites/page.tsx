'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Ticket,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Plus,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.invites.getStats.useQuery(undefined, { staleTime: 10_000 });
  const { data: allCodes, refetch: refetchCodes } = trpc.invites.getAll.useQuery({
    limit: 200
  }, { staleTime: 10_000 });

  // Mutations
  const generateSingle = trpc.invites.generate.useMutation({
    onSuccess: (data) => {
      const sentCount = 'emailSent' in data ? data.emailSent : 0;
      const requestedCount = 'emailRequested' in data ? data.emailRequested : 0;
      toast({
        title: 'Code generated!',
        description: requestedCount > 0
          ? `Generated ${data.codes[0]} and emailed ${sentCount}/${requestedCount}`
          : `Generated ${data.codes[0]}`,
      });
      refetchStats();
      refetchCodes();
      setRecentCodes(data.codes);
      setSingleEmail('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const generateBulk = trpc.invites.generate.useMutation({
    onSuccess: (data) => {
      const sentCount = 'emailSent' in data ? data.emailSent : 0;
      const requestedCount = 'emailRequested' in data ? data.emailRequested : 0;
      toast({
        title: 'Codes generated!',
        description: requestedCount > 0
          ? `Generated ${data.created} codes and emailed ${sentCount}/${requestedCount}`
          : `Generated ${data.created} invite codes`,
      });
      refetchStats();
      refetchCodes();
      setRecentCodes(data.codes);
      setBulkEmails('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const cleanupExpired = trpc.invites.cleanupExpired.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Cleanup complete',
        description: `Deleted ${data.deletedCount} expired codes`,
      });
      refetchStats();
      refetchCodes();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
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
    toast({
      title: 'Copied!',
      description: `${code} copied to clipboard`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = async (codes: string[]) => {
    if (codes.length === 0) return;
    await navigator.clipboard.writeText(codes.join('\n'));
    toast({
      title: 'Copied!',
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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Ticket className="h-8 w-8" />
          Beta Invite Codes
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate and manage closed beta invite codes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList role="tablist">
          <TabsTrigger value="generate" role="tab" aria-selected={undefined} aria-controls="panel-generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="codes" role="tab" aria-selected={undefined} aria-controls="panel-codes">
            <Ticket className="h-4 w-4 mr-2" />
            Codes ({allCodes?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab (Combined Overview + Generate) */}
        <TabsContent value="generate" className="space-y-6" role="tabpanel" id="panel-generate">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Codes</CardDescription>
                <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Used</CardDescription>
                <CardTitle className="text-3xl text-green-600">
                  {stats?.used || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Unused</CardDescription>
                <CardTitle className="text-3xl text-blue-600">
                  {stats?.unused || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Expired</CardDescription>
                <CardTitle className="text-3xl text-red-600">
                  {stats?.expired || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Generation Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single Code */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Single Code</CardTitle>
                <CardDescription>
                  Create one invite code for immediate use
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="single-email">Email recipient (optional)</Label>
                  <Input
                    id="single-email"
                    type="email"
                    placeholder="user@example.com"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleGenerateSingle}
                  disabled={generateSingle.isPending}
                  className="w-full"
                  size="lg"
                >
                  {generateSingle.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      Generate Code
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Bulk Generation */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Bulk Codes</CardTitle>
                <CardDescription>
                  Create multiple codes at once (max 1000)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="count">Number of codes (1-1000)</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={1000}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires">
                    Expires in (days) - Optional
                  </Label>
                  <Input
                    id="expires"
                    type="number"
                    min={1}
                    max={365}
                    placeholder="Leave empty for no expiration"
                    value={bulkExpireDays || ''}
                    onChange={(e) =>
                      setBulkExpireDays(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-emails">
                    Email recipients (optional, comma/newline separated)
                  </Label>
                  <Textarea
                    id="bulk-emails"
                    placeholder="alice@example.com, bob@example.com"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button
                  onClick={handleGenerateBulk}
                  disabled={generateBulk.isPending}
                  className="w-full"
                  size="lg"
                >
                  {generateBulk.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      Generate {bulkCount} Codes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {recentCodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Generated Codes</CardTitle>
                <CardDescription>
                  Keep these visible while you distribute them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => copyAllCodes(recentCodes)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('codes')}
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    View in Codes Table
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentCodes.map((code) => (
                    <div
                      key={code}
                      className="rounded-lg border border-border/60 bg-card/50 p-4"
                    >
                      <div className="font-mono text-sm font-semibold">{code}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 px-0"
                        onClick={() => copyToClipboard(code)}
                      >
                        {copiedCode === code ? (
                          <>
                            <Check className="h-4 w-4 mr-2 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
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

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Manage existing codes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    refetchStats();
                    refetchCodes();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => cleanupExpired.mutate()}
                  disabled={cleanupExpired.isPending || (stats?.expired || 0) === 0}
                >
                  {cleanupExpired.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Expired ({stats?.expired || 0})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Codes Tab */}
        <TabsContent value="codes" role="tabpanel" id="panel-codes">
          <Card>
            <CardHeader>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>
                Filter and copy recent codes from the latest 200 records.
              </CardDescription>
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
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Visible
                </Button>
              </div>

              {!allCodes || filteredCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No codes match this filter.
                </div>
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
                        <TableCell className="font-mono font-semibold">
                          {code.code}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === 'Used'
                                ? 'secondary'
                                : status === 'Expired'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(code.createdAt)}
                        </TableCell>
                        <TableCell>
                          {code.expiresAt ? (
                            <Badge variant={
                              new Date(code.expiresAt) < new Date() && !code.usedBy
                                ? 'destructive'
                                : 'secondary'
                            }>
                              {formatDate(code.expiresAt)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Never</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(code.usedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(code.code)}
                            aria-label="Copy invite code"
                          >
                            {copiedCode === code.code ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )})}
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
