'use client';

import { trpc } from '@/lib/trpc';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  Grid,
  Badge,
  Select,
  TextField,
  DropdownMenu,
  Tabs,
} from '@radix-ui/themes';
import {
  Plus,
  Book,
  Swords,
  Wand2,
  MapPin,
  Shield,
  Scroll,
  FileText,
  Search,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { HomebrewPDFUpload } from '@/components/homebrew/HomebrewPDFUpload';
import { HomebrewPDFList } from '@/components/homebrew/HomebrewPDFList';

// Icon mapping for homebrew types
const typeIcons: Record<string, any> = {
  item: Swords,
  creature: Shield,
  spell: Wand2,
  location: MapPin,
  subclass: Book,
  feat: Scroll,
  rule: FileText,
};

const typeColors: Record<string, string> = {
  item: 'amber',
  creature: 'red',
  spell: 'violet',
  location: 'green',
  subclass: 'blue',
  feat: 'orange',
  rule: 'gray',
};

export default function HomebrewLibraryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get all user's homebrew content - only enabled when authenticated
  const { data: homebrew, isLoading, isError, error, refetch } = trpc.homebrew.getContent.useQuery(
    {
      type: selectedType === 'all' ? undefined : selectedType,
    },
    {
      retry: 2,
      retryDelay: 1000,
      enabled: status === 'authenticated',
    }
  );

  // Get stats for the user's homebrew - only enabled when authenticated
  const { data: stats } = trpc.homebrew.getContentStats.useQuery(
    {},
    {
      retry: 2,
      retryDelay: 1000,
      enabled: status === 'authenticated',
    }
  );

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/homebrew');
    }
  }, [status, router]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
          <Heading size="8">My Homebrew Library</Heading>
          <Text>Checking authentication...</Text>
        </Flex>
      </Container>
    );
  }

  // Don't render content if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null;
  }

  // Filter by search query (client-side)
  const filteredHomebrew = homebrew?.items.filter((item) =>
    searchQuery
      ? item.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  // Error state
  if (isError) {
    return (
      <Container size="4" className="py-8">
        <Card>
          <Flex direction="column" gap="4" p="6" align="center">
            <Text size="5" weight="bold" color="red">
              Error Loading Homebrew Library
            </Text>
            <Text color="gray" align="center">
              {error?.message || 'An unexpected error occurred'}
            </Text>
            <Flex gap="3">
              <Button onClick={() => refetch()}>
                Retry
              </Button>
              <Button variant="soft" onClick={() => router.push('/')}>
                Go Home
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Container>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
          <Flex justify="between" align="center">
            <Heading size="8">My Homebrew Library</Heading>
          </Flex>
          <Text>Loading homebrew library...</Text>
        </Flex>
      </Container>
    );
  }

  return (
    <Container size="4" className="py-8">
      <Flex direction="column" gap="6">
        {/* Header */}
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center">
            <Heading size="8">My Homebrew Library</Heading>
            <Flex gap="3">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button size="3">
                    <Plus size={20} />
                    Create Homebrew
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/item')}>
                    ⚔️ Magic Item
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/spell')}>
                    ✨ Spell
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/feat')}>
                    💪 Feat
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/background')}>
                    📜 Background
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/race')}>
                    👤 Race
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/creature')}>
                    🐉 Creature
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/class')}>
                    🛡️ Class
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => router.push('/homebrew/create/subclass')}>
                    📖 Subclass
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Flex>
          </Flex>

          {/* Stats */}
          {stats && (
            <Grid columns="7" gap="3">
              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <Book size={20} className="text-violet-400" />
                  <Text size="4" weight="bold">
                    {stats.total}
                  </Text>
                  <Text size="1" color="gray">
                    Total
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <Swords size={20} className="text-amber-400" />
                  <Text size="4" weight="bold">
                    {stats.byType.item || 0}
                  </Text>
                  <Text size="1" color="gray">
                    Items
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <Shield size={20} className="text-red-400" />
                  <Text size="4" weight="bold">
                    {stats.byType.creature || 0}
                  </Text>
                  <Text size="1" color="gray">
                    Creatures
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <Wand2 size={20} className="text-violet-400" />
                  <Text size="4" weight="bold">
                    {stats.byType.spell || 0}
                  </Text>
                  <Text size="1" color="gray">
                    Spells
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <MapPin size={20} className="text-green-400" />
                  <Text size="4" weight="bold">
                    {stats.byType.location || 0}
                  </Text>
                  <Text size="1" color="gray">
                    Locations
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <Scroll size={20} className="text-orange-400" />
                  <Text size="4" weight="bold">
                    {stats.byType.feat || 0}
                  </Text>
                  <Text size="1" color="gray">
                    Feats
                  </Text>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" align="center" gap="2" p="2">
                  <FileText size={20} className="text-gray-400" />
                  <Text size="4" weight="bold">
                    {(stats.byType.subclass || 0) + (stats.byType.rule || 0)}
                  </Text>
                  <Text size="1" color="gray">
                    Other
                  </Text>
                </Flex>
              </Card>
            </Grid>
          )}
        </Flex>

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
                {/* Filters */}
                <Flex gap="3" align="center">
                  <TextField.Root
                    placeholder="Search homebrew..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="3"
                    style={{ flex: 1 }}
                  >
                    <TextField.Slot>
                      <Search size={16} />
                    </TextField.Slot>
                  </TextField.Root>

                  <Select.Root value={selectedType} onValueChange={setSelectedType}>
                    <Select.Trigger style={{ width: 200 }} />
                    <Select.Content>
                      <Select.Item value="all">All Types</Select.Item>
                      <Select.Item value="item">Items</Select.Item>
                      <Select.Item value="creature">Creatures</Select.Item>
                      <Select.Item value="spell">Spells</Select.Item>
                      <Select.Item value="location">Locations</Select.Item>
                      <Select.Item value="subclass">Subclasses</Select.Item>
                      <Select.Item value="feat">Feats</Select.Item>
                      <Select.Item value="rule">Rules</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>

                {/* Homebrew Grid */}
                {!filteredHomebrew || filteredHomebrew.length === 0 ? (
                  <Card>
                    <Flex
                      direction="column"
                      align="center"
                      justify="center"
                      gap="4"
                      p="8"
                    >
                      <Book size={48} className="text-gray-500" />
                      <Heading size="5" color="gray">
                        {searchQuery || selectedType !== 'all'
                          ? 'No homebrew found matching filters'
                          : 'No homebrew content yet'}
                      </Heading>
                      <Text size="2" color="gray" align="center">
                        {searchQuery || selectedType !== 'all'
                          ? 'Try adjusting your search or filters'
                          : 'Create your first homebrew content to get started'}
                      </Text>
                      {!searchQuery && selectedType === 'all' && (
                        <Link href="/homebrew/create/item">
                          <Button size="3">
                            <Plus size={20} />
                            Create Homebrew
                          </Button>
                        </Link>
                      )}
                    </Flex>
                  </Card>
                ) : (
                  <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="4">
                    {filteredHomebrew.map((item) => {
                      const Icon = typeIcons[item.type] || Book;
                      const color = typeColors[item.type] || 'gray';

                      return (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:bg-gray-800 transition-colors"
                        >
                          <Flex direction="column" gap="3" p="4">
                            {/* Header */}
                            <Flex justify="between" align="start">
                              <Flex direction="column" gap="2" style={{ flex: 1 }}>
                                <Flex align="center" gap="2">
                                  <Icon size={20} />
                                  <Heading size="4">{item.name}</Heading>
                                </Flex>
                                <Badge color={color as any}>{item.type}</Badge>
                              </Flex>
                            </Flex>

                            {/* Tags */}
                            {item.tags && item.tags.length > 0 && (
                              <Flex gap="2" wrap="wrap">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="soft" size="1">
                                    {tag}
                                  </Badge>
                                ))}
                                {item.tags.length > 3 && (
                                  <Badge variant="soft" size="1" color="gray">
                                    +{item.tags.length - 3}
                                  </Badge>
                                )}
                              </Flex>
                            )}

                            {/* Footer */}
                            <Flex
                              justify="between"
                              align="center"
                              pt="2"
                              style={{ borderTop: '1px solid var(--gray-6)' }}
                            >
                              <Text size="1" color="gray">
                                Updated {new Date(item.updatedAt).toLocaleDateString()}
                              </Text>
                              <Flex gap="2">
                                <Link href={`/homebrew/${item.id}/edit`}>
                                  <Button size="1" variant="soft">
                                    Edit
                                  </Button>
                                </Link>
                                <Button size="1" variant="soft" color="violet">
                                  Add to Campaign
                                </Button>
                              </Flex>
                            </Flex>
                          </Flex>
                        </Card>
                      );
                    })}
                  </Grid>
                )}
              </Flex>
            </Tabs.Content>

            <Tabs.Content value="pdfs">
              <Flex direction="column" gap="4">
                <HomebrewPDFUpload />
                <HomebrewPDFList />
              </Flex>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Flex>
    </Container>
  );
}
