'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkExpireDays, setBulkExpireDays] = useState<number | undefined>();
  const [bulkEmails, setBulkEmails] = useState('');

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.invites.getStats.useQuery();
  const { data: unusedCodes, refetch: refetchUnused } = trpc.invites.getUnused.useQuery({
    limit: 100
  });

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
      refetchUnused();
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
      refetchUnused();
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
      refetchUnused();
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

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="codes">
            <Ticket className="h-4 w-4 mr-2" />
            All Codes ({stats?.unused || 0})
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab (Combined Overview + Generate) */}
        <TabsContent value="generate" className="space-y-6">
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
                  <Input
                    id="bulk-emails"
                    placeholder="alice@example.com, bob@example.com"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
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
                    refetchUnused();
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
        <TabsContent value="codes">
          <Card>
            <CardHeader>
              <CardTitle>Unused Invite Codes</CardTitle>
              <CardDescription>
                Available codes ready for distribution (showing latest 100)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!unusedCodes || unusedCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No unused codes available. Generate some codes to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unusedCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-semibold">
                          {code.code}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(code.createdAt)}
                        </TableCell>
                        <TableCell>
                          {code.expiresAt ? (
                            <Badge variant={
                              new Date(code.expiresAt) < new Date()
                                ? 'destructive'
                                : 'secondary'
                            }>
                              {formatDate(code.expiresAt)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Never</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(code.code)}
                          >
                            {copiedCode === code.code ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
