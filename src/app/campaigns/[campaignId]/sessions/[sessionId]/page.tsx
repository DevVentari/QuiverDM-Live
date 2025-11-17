'use client';

import { use, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  TextArea,
  Separator,
  IconButton
} from '@radix-ui/themes';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Save,
  Play,
  CheckCircle,
  FileAudio,
  FileText,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';

interface SessionDetailPageProps {
  params: Promise<{
    campaignId: string;
    sessionId: string;
  }>;
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { campaignId, sessionId } = use(params);
  const router = useRouter();

  const [quickNotes, setQuickNotes] = useState('');
  const [recap, setRecap] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: session, isLoading } = trpc.sessions.getById.useQuery({
    id: sessionId,
  });

  const updateSessionMutation = trpc.sessions.update.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      setLastSaved(new Date());
    },
  });

  const completeSessionMutation = trpc.sessions.complete.useMutation({
    onSuccess: () => {
      router.push(`/campaigns/${campaignId}/sessions`);
    },
  });

  // Initialize state when session loads
  useEffect(() => {
    if (session) {
      setQuickNotes(session.quickNotes || '');
      setRecap(session.recap || '');
    }
  }, [session]);

  // Auto-save with debounce
  useEffect(() => {
    if (!session) return;

    const timeoutId = setTimeout(() => {
      if (quickNotes !== session.quickNotes || recap !== session.recap) {
        setIsSaving(true);
        updateSessionMutation.mutate({
          id: sessionId,
          quickNotes,
          recap,
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [quickNotes, recap, session, sessionId]);

  const handleStatusChange = (newStatus: 'planning' | 'in_progress' | 'completed') => {
    if (newStatus === 'completed') {
      completeSessionMutation.mutate({
        id: sessionId,
        recap,
      });
    } else {
      updateSessionMutation.mutate({
        id: sessionId,
        status: newStatus,
      });
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'in_progress':
        return {
          color: 'blue' as const,
          icon: <Play size={16} />,
          label: 'In Progress',
        };
      case 'completed':
        return {
          color: 'green' as const,
          icon: <CheckCircle size={16} />,
          label: 'Completed',
        };
      default:
        return {
          color: 'gray' as const,
          icon: <Clock size={16} />,
          label: 'Planning',
        };
    }
  };

  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Text>Loading session...</Text>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container size="4" className="py-8">
        <Text>Session not found</Text>
      </Container>
    );
  }

  const status = getStatusInfo(session.status);

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="4">
          <Flex align="center" gap="3">
            <IconButton
              variant="ghost"
              onClick={() => router.push(`/campaigns/${campaignId}/sessions`)}
            >
              <ArrowLeft size={20} />
            </IconButton>
            <Flex direction="column" gap="1" style={{ flex: 1 }}>
              <Text size="1" color="gray" weight="medium">
                SESSION {session.sessionNumber}
              </Text>
              <Heading size="8">{session.title}</Heading>
            </Flex>
            <Badge color={status.color} size="2">
              {status.icon}
              {status.label}
            </Badge>
          </Flex>

          <Flex align="center" gap="4">
            <Flex align="center" gap="1">
              <Calendar size={14} className="text-gray-500" />
              <Text size="2" color="gray">
                {new Date(session.createdAt).toLocaleDateString()}
              </Text>
            </Flex>
            {lastSaved && (
              <Flex align="center" gap="1">
                <Save size={14} className="text-green-500" />
                <Text size="2" color="gray">
                  Saved {lastSaved.toLocaleTimeString()}
                </Text>
              </Flex>
            )}
            {isSaving && (
              <Flex align="center" gap="1">
                <Loader2 size={14} className="text-blue-500 animate-spin" />
                <Text size="2" color="gray">
                  Saving...
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>

        {/* Status Controls */}
        <Card>
          <Flex direction="column" gap="3">
            <Text size="2" weight="bold">Session Status</Text>
            <Flex gap="2">
              <Button
                variant={session.status === 'planning' ? 'solid' : 'soft'}
                onClick={() => handleStatusChange('planning')}
                disabled={updateSessionMutation.isPending}
              >
                <Clock size={16} />
                Planning
              </Button>
              <Button
                variant={session.status === 'in_progress' ? 'solid' : 'soft'}
                onClick={() => handleStatusChange('in_progress')}
                disabled={updateSessionMutation.isPending}
              >
                <Play size={16} />
                In Progress
              </Button>
              <Button
                variant={session.status === 'completed' ? 'solid' : 'soft'}
                color="green"
                onClick={() => handleStatusChange('completed')}
                disabled={completeSessionMutation.isPending}
              >
                <CheckCircle size={16} />
                {session.status === 'completed' ? 'Completed' : 'Mark Complete'}
              </Button>
            </Flex>
          </Flex>
        </Card>

        {/* Quick Notes */}
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Quick Notes</Heading>
            <Text size="2" color="gray">
              Jot down quick thoughts during the session
            </Text>
            <TextArea
              placeholder="What's happening in the session? Key moments, player decisions, important rolls..."
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              rows={8}
            />
          </Flex>
        </Card>

        {/* Session Recap */}
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Session Recap</Heading>
            <Text size="2" color="gray">
              Detailed summary of what happened this session
            </Text>
            <TextArea
              placeholder="Write a detailed recap of the session for your players..."
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              rows={12}
            />
          </Flex>
        </Card>

        <Separator size="4" />

        {/* Recordings */}
        <Card>
          <Flex direction="column" gap="4">
            <Flex align="center" gap="2">
              <FileAudio size={20} className="text-violet-500" />
              <Heading size="4">Recordings</Heading>
              <Badge color="gray">{session.recordings?.length || 0}</Badge>
            </Flex>

            {!session.recordings || session.recordings.length === 0 ? (
              <Flex direction="column" gap="2" align="center" p="4">
                <FileAudio size={48} className="text-gray-600" />
                <Text color="gray">No recordings yet</Text>
                <Text size="1" color="gray" align="center">
                  Upload audio or video files to transcribe your sessions
                </Text>
              </Flex>
            ) : (
              <Flex direction="column" gap="2">
                {session.recordings.map((recording) => (
                  <Card key={recording.id} variant="surface">
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Text weight="bold">Recording {recording.id.slice(0, 8)}</Text>
                        {recording.durationSeconds && (
                          <Text size="1" color="gray">
                            {Math.floor(recording.durationSeconds / 60)} minutes
                          </Text>
                        )}
                      </Flex>
                      <Button variant="soft" size="1">
                        View
                      </Button>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            )}
          </Flex>
        </Card>

        {/* Transcripts */}
        <Card>
          <Flex direction="column" gap="4">
            <Flex align="center" gap="2">
              <FileText size={20} className="text-violet-500" />
              <Heading size="4">Transcripts</Heading>
              <Badge color="gray">{session.transcripts?.length || 0}</Badge>
            </Flex>

            {!session.transcripts || session.transcripts.length === 0 ? (
              <Flex direction="column" gap="2" align="center" p="4">
                <FileText size={48} className="text-gray-600" />
                <Text color="gray">No transcripts yet</Text>
                <Text size="1" color="gray" align="center">
                  Transcripts will appear here after processing recordings
                </Text>
              </Flex>
            ) : (
              <Flex direction="column" gap="2">
                {session.transcripts.map((transcript) => (
                  <Card key={transcript.id} variant="surface">
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Text weight="bold">Transcript {transcript.id.slice(0, 8)}</Text>
                        {transcript.hasSpeakers && (
                          <Badge color="violet" size="1">
                            Speaker Detection
                          </Badge>
                        )}
                      </Flex>
                      <Button variant="soft" size="1">
                        View
                      </Button>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            )}
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
