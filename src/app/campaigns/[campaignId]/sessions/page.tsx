'use client';

import { use } from 'react';
import { trpc } from '@/lib/trpc';
import { Box, Card, Container, Flex, Heading, Text, Button, Badge } from '@radix-ui/themes';
import { Plus, Clock, Calendar, FileText, Play, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CampaignNav from '@/components/CampaignNav';

interface SessionsPageProps {
  params: Promise<{ campaignId: string }>;
}

export default function SessionsPage({ params }: SessionsPageProps) {
  const { campaignId } = use(params);
  const router = useRouter();

  const { data: sessions, isLoading } = trpc.sessions.getAll.useQuery({
    campaignId,
  });

  const { data: activeSession } = trpc.sessions.getActive.useQuery({
    campaignId,
  });

  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      router.push(`/campaigns/${campaignId}/sessions/${session.id}`);
    },
  });

  const handleStartSession = () => {
    createSessionMutation.mutate({
      campaignId,
    });
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
        <Text>Loading sessions...</Text>
      </Container>
    );
  }

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex justify="between" align="center">
          <Heading size="8">Sessions</Heading>
          <Button
            size="3"
            onClick={handleStartSession}
            disabled={!!activeSession || createSessionMutation.isPending}
          >
            <Plus size={20} />
            {activeSession ? 'Session In Progress' : 'Start New Session'}
          </Button>
        </Flex>

        {/* Active Session Banner */}
        {activeSession && (
          <Card style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
            <Flex direction="column" gap="3">
              <Flex align="center" gap="2">
                <Play size={24} />
                <Heading size="5">Active Session</Heading>
              </Flex>
              <Text size="4" weight="bold">
                {activeSession.title}
              </Text>
              <Button
                size="2"
                variant="soft"
                style={{ width: 'fit-content' }}
                onClick={() => router.push(`/campaigns/${campaignId}/sessions/${activeSession.id}`)}
              >
                Continue Session
              </Button>
            </Flex>
          </Card>
        )}

        {/* Sessions List */}
        {!sessions || sessions.length === 0 ? (
          <Card>
            <Flex direction="column" gap="4" align="center" p="8">
              <FileText size={64} className="text-gray-600" />
              <Heading size="4">No Sessions Yet</Heading>
              <Text color="gray" align="center">
                Start your first session to begin tracking your campaign
              </Text>
              <Button size="3" onClick={handleStartSession}>
                <Plus size={20} />
                Start First Session
              </Button>
            </Flex>
          </Card>
        ) : (
          <Flex direction="column" gap="3">
            {sessions.map((session) => {
              const status = getStatusInfo(session.status);

              return (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:bg-gray-800 transition-colors"
                  onClick={() => router.push(`/campaigns/${campaignId}/sessions/${session.id}`)}
                >
                  <Flex justify="between" align="center">
                    <Flex direction="column" gap="2" style={{ flex: 1 }}>
                      <Flex align="center" gap="2">
                        <Text size="1" color="gray" weight="medium">
                          SESSION {session.sessionNumber}
                        </Text>
                        <Badge color={status.color}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </Flex>

                      <Heading size="4">{session.title}</Heading>

                      {session.quickNotes && (
                        <Text size="2" color="gray" className="line-clamp-2">
                          {session.quickNotes.substring(0, 150)}
                          {session.quickNotes.length > 150 ? '...' : ''}
                        </Text>
                      )}

                      <Flex gap="4" align="center">
                        <Flex align="center" gap="1">
                          <Calendar size={14} className="text-gray-500" />
                          <Text size="1" color="gray">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </Text>
                        </Flex>

                        {session.recordings && session.recordings.length > 0 && (
                          <Flex align="center" gap="1">
                            <FileText size={14} className="text-gray-500" />
                            <Text size="1" color="gray">
                              {session.recordings.length} recording
                              {session.recordings.length !== 1 ? 's' : ''}
                            </Text>
                          </Flex>
                        )}

                        {session.transcripts && session.transcripts.length > 0 && (
                          <Flex align="center" gap="1">
                            <FileText size={14} className="text-gray-500" />
                            <Text size="1" color="gray">
                              {session.transcripts.length} transcript
                              {session.transcripts.length !== 1 ? 's' : ''}
                            </Text>
                          </Flex>
                        )}
                      </Flex>
                    </Flex>
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Container>
  );
}
