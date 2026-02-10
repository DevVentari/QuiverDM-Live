'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Heading,
  Text,
  Card,
  Flex,
  Button,
  TextField,
  Box,
} from '@radix-ui/themes';
import { Users, Sparkles, ArrowRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function JoinCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code');

  const [inviteCode, setInviteCode] = useState(codeFromUrl || '');
  const [status, setStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [joinedCampaign, setJoinedCampaign] = useState<{ name: string; slug: string } | null>(null);

  const acceptInviteMutation = trpc.members.acceptInvite.useMutation();

  const handleJoin = useCallback(async (code: string) => {
    if (!code.trim()) {
      setErrorMessage('Please enter an invite code');
      setStatus('error');
      return;
    }

    setStatus('joining');
    setErrorMessage('');

    try {
      const result = await acceptInviteMutation.mutateAsync({ code: code.trim() });
      setJoinedCampaign({
        name: result.campaignName || 'Campaign',
        slug: result.campaignSlug || result.campaignId,
      });
      setStatus('success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to join campaign');
      setStatus('error');
    }
  }, [acceptInviteMutation]);

  // Auto-join if code is provided in URL
  useEffect(() => {
    if (codeFromUrl && status === 'idle') {
      handleJoin(codeFromUrl);
    }
  }, [codeFromUrl, handleJoin, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoin(inviteCode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30 flex items-center justify-center p-4">
      <Container size="1" style={{ maxWidth: '480px' }}>
        <Card className="bg-gray-800/70 backdrop-blur-sm border border-gray-700 overflow-hidden">
          {/* Header */}
          <div
            className="p-8 text-center relative"
            style={{
              background: 'linear-gradient(135deg, var(--violet-9) 0%, var(--purple-9) 50%, var(--pink-9) 100%)',
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Users size={40} className="text-white" />
              </div>
              <Heading size="7" className="text-white mb-2">
                Join a Campaign
              </Heading>
              <Text className="text-purple-100">
                Enter your invite code to join an adventure
              </Text>
            </div>
          </div>

          {/* Content */}
          <Box p="6">
            {status === 'success' && joinedCampaign ? (
              <Flex direction="column" align="center" gap="4">
                <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <Heading size="5" className="text-white text-center">
                  Welcome to {joinedCampaign.name}!
                </Heading>
                <Text className="text-gray-400 text-center">
                  You&apos;ve successfully joined the campaign. You can now add your characters and start your adventure.
                </Text>
                <Flex gap="3" mt="2">
                  <Link href={`/campaigns/${joinedCampaign.slug}`}>
                    <Button size="3" style={{ backgroundColor: '#8B5CF6' }}>
                      <Sparkles size={18} />
                      View Campaign
                    </Button>
                  </Link>
                  <Link href="/characters">
                    <Button size="3" variant="soft">
                      My Characters
                    </Button>
                  </Link>
                </Flex>
              </Flex>
            ) : (
              <form onSubmit={handleSubmit}>
                <Flex direction="column" gap="4">
                  {/* Invite Code Input */}
                  <Box>
                    <Text as="label" size="2" weight="bold" className="text-gray-300 block mb-2">
                      Invite Code
                    </Text>
                    <TextField.Root
                      size="3"
                      placeholder="Enter invite code (e.g., ABC123)"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        if (status === 'error') setStatus('idle');
                      }}
                      disabled={status === 'joining'}
                      style={{
                        fontSize: '1.25rem',
                        letterSpacing: '0.1em',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                      }}
                    />
                  </Box>

                  {/* Error Message */}
                  {status === 'error' && (
                    <Card className="bg-red-900/30 border border-red-700">
                      <Flex align="center" gap="2" p="3">
                        <XCircle size={18} className="text-red-400 flex-shrink-0" />
                        <Text size="2" className="text-red-300">{errorMessage}</Text>
                      </Flex>
                    </Card>
                  )}

                  {/* Submit Button */}
                  <Button
                    size="4"
                    type="submit"
                    disabled={status === 'joining' || !inviteCode.trim()}
                    style={{ backgroundColor: '#8B5CF6' }}
                  >
                    {status === 'joining' ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Campaign
                        <ArrowRight size={20} />
                      </>
                    )}
                  </Button>

                  {/* Help Text */}
                  <Text size="1" className="text-gray-500 text-center">
                    Ask your Dungeon Master for an invite code if you don&apos;t have one
                  </Text>
                </Flex>
              </form>
            )}
          </Box>

          {/* Footer */}
          <Box className="border-t border-gray-700 p-4">
            <Flex justify="center" gap="4">
              <Link href="/dashboard">
                <Text size="2" className="text-gray-400 hover:text-purple-400 transition-colors">
                  Dashboard
                </Text>
              </Link>
              <Text size="2" className="text-gray-600">•</Text>
              <Link href="/characters">
                <Text size="2" className="text-gray-400 hover:text-purple-400 transition-colors">
                  My Characters
                </Text>
              </Link>
              <Text size="2" className="text-gray-600">•</Text>
              <Link href="/campaigns">
                <Text size="2" className="text-gray-400 hover:text-purple-400 transition-colors">
                  Campaigns
                </Text>
              </Link>
            </Flex>
          </Box>
        </Card>
      </Container>
    </div>
  );
}

export default function JoinCampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900/30 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    }>
      <JoinCampaignContent />
    </Suspense>
  );
}
