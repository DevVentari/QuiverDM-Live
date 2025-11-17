'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, Heading, Container, Dialog, Button, Flex, Text, Card, Grid, Badge, Box, VisuallyHidden } from '@radix-ui/themes';
import { HomebrewContentList } from '@/components/homebrew/HomebrewContentList';
import { HomebrewContentDetail } from '@/components/homebrew/HomebrewContentDetail';
import { HomebrewPDFUpload } from '@/components/homebrew/HomebrewPDFUpload';
import { HomebrewPDFList } from '@/components/homebrew/HomebrewPDFList';
import { trpc } from '@/lib/trpc';
import CampaignNav from '@/components/CampaignNav';
import { Book, Plus, Library, FileText } from 'lucide-react';
import Link from 'next/link';

export default function HomebrewPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [showAddFromLibraryDialog, setShowAddFromLibraryDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: stats } = trpc.homebrew.getContentStats.useQuery({ campaignId });

  // Get user's homebrew that's NOT in this campaign
  const { data: userHomebrew } = trpc.homebrew.getContent.useQuery({});
  const { data: campaignHomebrew } = trpc.homebrew.getContent.useQuery({ campaignId });

  const addToCampaign = trpc.homebrew.addToCampaign.useMutation({
    onSuccess: () => {
      setRefreshKey((prev) => prev + 1);
    },
  });

  const removeFromCampaign = trpc.homebrew.removeFromCampaign.useMutation({
    onSuccess: () => {
      setRefreshKey((prev) => prev + 1);
    },
  });

  const handleContentClick = (contentId: string) => {
    setSelectedContentId(contentId);
  };

  const handleAddToCampaign = async (homebrewId: string) => {
    await addToCampaign.mutateAsync({ homebrewId, campaignId });
  };

  const handleRemoveFromCampaign = async (homebrewId: string) => {
    await removeFromCampaign.mutateAsync({ homebrewId, campaignId });
  };

  // Filter out homebrew already in campaign
  const campaignHomebrewIds = new Set(campaignHomebrew?.items.map((item) => item.id) || []);
  const availableHomebrew = userHomebrew?.items.filter(
    (item) => !campaignHomebrewIds.has(item.id)
  ) || [];

  return (
    <Container size="4" className="py-8">
      <CampaignNav campaignId={campaignId} />

      {/* Header */}
      <Flex direction="column" gap="4" mb="6">
        <Flex justify="between" align="center">
          <Flex direction="column" gap="2">
            <Heading size="8">Campaign Homebrew</Heading>
            {stats && (
              <Text size="2" color="gray">
                {stats.total} items across {Object.keys(stats.byType).length} categories
              </Text>
            )}
          </Flex>

          <Flex gap="3">
            <Link href="/homebrew">
              <Button size="3" variant="soft">
                <Library size={20} />
                My Library
              </Button>
            </Link>
            <Button size="3" onClick={() => setShowAddFromLibraryDialog(true)}>
              <Plus size={20} />
              Add from Library
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {/* Add from Library Dialog */}
      <Dialog.Root open={showAddFromLibraryDialog} onOpenChange={setShowAddFromLibraryDialog}>
        <Dialog.Content style={{ maxWidth: 700, maxHeight: '80vh' }}>
          <Dialog.Title>Add Homebrew from Your Library</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Select homebrew content from your personal library to add to this campaign.
          </Dialog.Description>

          {availableHomebrew.length === 0 ? (
            <Card>
              <Flex direction="column" align="center" gap="4" p="6">
                <Book size={48} className="text-gray-500" />
                <Text size="3" color="gray" align="center">
                  All your homebrew content is already in this campaign!
                </Text>
                <Link href="/homebrew">
                  <Button size="2">
                    <Plus size={16} />
                    Create More Homebrew
                  </Button>
                </Link>
              </Flex>
            </Card>
          ) : (
            <Flex direction="column" gap="3" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {availableHomebrew.map((item) => (
                <Card key={item.id}>
                  <Flex justify="between" align="center" p="3">
                    <Flex direction="column" gap="2">
                      <Flex align="center" gap="2">
                        <Text size="3" weight="bold">{item.name}</Text>
                        <Badge>{item.type}</Badge>
                      </Flex>
                      {item.tags && item.tags.length > 0 && (
                        <Flex gap="2">
                          {item.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="soft" size="1">
                              {tag}
                            </Badge>
                          ))}
                        </Flex>
                      )}
                    </Flex>
                    <Button
                      size="2"
                      onClick={() => handleAddToCampaign(item.id)}
                      disabled={addToCampaign.isLoading}
                    >
                      <Plus size={16} />
                      Add
                    </Button>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>

      {/* Tabs for Content vs PDFs */}
      <Tabs.Root defaultValue="content">
        <Tabs.List>
          <Tabs.Trigger value="content">
            <Book size={16} />
            Homebrew Content
          </Tabs.Trigger>
          <Tabs.Trigger value="pdfs">
            <FileText size={16} />
            PDF Library
          </Tabs.Trigger>
        </Tabs.List>

        <Box pt="4">
          <Tabs.Content value="content">
            <Flex direction="column" gap="4">
              {/* Stats Cards */}
              {stats && stats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.byType).map(([type, count]) => {
                    const icons: Record<string, string> = {
                      item: '⚔️',
                      creature: '🐉',
                      spell: '✨',
                      location: '🗺️',
                      subclass: '📜',
                      feat: '💪',
                      rule: '📖',
                    };

                    return (
                      <div
                        key={type}
                        className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-violet-500 transition-colors"
                      >
                        <div className="text-2xl mb-2">{icons[type] || '📄'}</div>
                        <div className="text-2xl font-bold text-violet-400">{count}</div>
                        <div className="text-sm text-gray-400 capitalize">{type}s</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Content List */}
              <div>
                <HomebrewContentList
                  campaignId={campaignId}
                  onContentClick={handleContentClick}
                  key={`content-${refreshKey}`}
                />
              </div>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="pdfs">
            <Flex direction="column" gap="4">
              <HomebrewPDFUpload campaignId={campaignId} />
              <HomebrewPDFList campaignId={campaignId} />
            </Flex>
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {/* Content Detail Dialog */}
      <Dialog.Root
        open={selectedContentId !== null}
        onOpenChange={(open) => !open && setSelectedContentId(null)}
      >
        <Dialog.Content style={{ maxWidth: 700, maxHeight: '85vh', overflow: 'auto' }}>
          <VisuallyHidden>
            <Dialog.Title>Homebrew Content Details</Dialog.Title>
          </VisuallyHidden>
          {selectedContentId && (
            <HomebrewContentDetail
              contentId={selectedContentId}
              onClose={() => setSelectedContentId(null)}
            />
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Container>
  );
}
