import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, Card, Flex, Text, Heading, Grid, Box, Avatar, Separator } from '@radix-ui/themes';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Fetch user's campaigns directly with Prisma
  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          gameSessions: true,
          npcs: true,
          players: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Heading size="8" className="text-white mb-2">
            Welcome back, {session.user.name?.split(' ')[0] || 'Dungeon Master'}
          </Heading>
          <Text size="4" className="text-gray-400">
            Your campaigns and recent activity
          </Text>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2 columns */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Campaigns */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <Heading size="6" className="text-white">Your Campaigns</Heading>
                <Link href="/campaigns/new">
                  <Button size="2" style={{ backgroundColor: '#8B5CF6' }}>
                    + New Campaign
                  </Button>
                </Link>
              </div>

              {campaigns.length === 0 ? (
                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-12 text-center">
                  <div className="text-6xl mb-4">🎲</div>
                  <Heading size="5" className="text-white mb-3">No Campaigns Yet</Heading>
                  <Text className="text-gray-400 mb-6">
                    Create your first campaign to start managing sessions, NPCs, and homebrew content.
                  </Text>
                  <Link href="/campaigns/new">
                    <Button size="3" style={{ backgroundColor: '#8B5CF6' }}>
                      Create Your First Campaign
                    </Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {campaigns.map((campaign) => (
                    <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                      <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-purple-500 transition-all p-6 cursor-pointer group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Heading size="5" className="text-white group-hover:text-purple-400 transition-colors">
                                {campaign.name}
                              </Heading>
                              <Badge color="purple" variant="soft">Active</Badge>
                            </div>
                            {campaign.description && (
                              <Text className="text-gray-400 mb-4 line-clamp-2">
                                {campaign.description}
                              </Text>
                            )}
                            <div className="flex gap-6 text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <span>📖</span>
                                <span>{campaign._count?.gameSessions || 0} sessions</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <span>👥</span>
                                <span>{campaign._count?.players || 0} players</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <span>🎭</span>
                                <span>{campaign._count?.npcs || 0} NPCs</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-400 group-hover:text-purple-400 transition-colors">
                            →
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Activity */}
            <section>
              <Heading size="6" className="text-white mb-6">Recent Activity</Heading>
              <div className="space-y-4">
                {/* Activity items would be loaded from actual data */}
                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      🎙️
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text className="text-white font-semibold">Session Recording Complete</Text>
                        <Text className="text-gray-500 text-sm">2 hours ago</Text>
                      </div>
                      <Text className="text-gray-400 text-sm">
                        Transcription and summary generated for Session 12: The Dragon&apos;s Lair
                      </Text>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      📚
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text className="text-white font-semibold">PDF Processed</Text>
                        <Text className="text-gray-500 text-sm">1 day ago</Text>
                      </div>
                      <Text className="text-gray-400 text-sm">
                        15 new items extracted from &quot;Custom Magic Items Compendium&quot;
                      </Text>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      🎭
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text className="text-white font-semibold">New NPC Created</Text>
                        <Text className="text-gray-500 text-sm">3 days ago</Text>
                      </div>
                      <Text className="text-gray-400 text-sm">
                        Added Thaldrin the Wise to Curse of Strahd campaign
                      </Text>
                    </div>
                  </div>
                </Card>

                {campaigns.length === 0 && (
                  <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-8 text-center">
                    <Text className="text-gray-400">
                      No activity yet. Create a campaign to get started!
                    </Text>
                  </Card>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar - Right column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
              <Heading size="4" className="text-white mb-4">Quick Actions</Heading>
              <div className="space-y-3">
                <Link href="/campaigns/new">
                  <Button variant="soft" size="2" style={{ width: '100%', justifyContent: 'flex-start' }}>
                    <span className="mr-2">🎯</span> Create Campaign
                  </Button>
                </Link>
                <Link href="/homebrew">
                  <Button variant="soft" size="2" style={{ width: '100%', justifyContent: 'flex-start' }}>
                    <span className="mr-2">📚</span> Upload PDF
                  </Button>
                </Link>
                <Button variant="soft" size="2" style={{ width: '100%', justifyContent: 'flex-start' }} disabled>
                  <span className="mr-2">🎙️</span> Record Session
                </Button>
                <Button variant="soft" size="2" style={{ width: '100%', justifyContent: 'flex-start' }} disabled>
                  <span className="mr-2">🎭</span> Create NPC
                </Button>
              </div>
            </Card>

            {/* TTRPG Tips */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-sm border border-purple-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💡</span>
                <Heading size="4" className="text-white">DM Tips</Heading>
              </div>
              <div className="space-y-4">
                <div>
                  <Text className="text-purple-200 font-semibold mb-1 block">Session Recording</Text>
                  <Text className="text-purple-100 text-sm">
                    Enable speaker detection to automatically identify who said what during your sessions.
                  </Text>
                </div>
                <Separator className="bg-purple-700/50" />
                <div>
                  <Text className="text-purple-200 font-semibold mb-1 block">Homebrew Organization</Text>
                  <Text className="text-purple-100 text-sm">
                    Tag your homebrew content with keywords to make it easier to search during sessions.
                  </Text>
                </div>
              </div>
            </Card>

            {/* Community News */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
              <Heading size="4" className="text-white mb-4">TTRPG News</Heading>
              <div className="space-y-4">
                <div>
                  <Text className="text-white font-semibold mb-1 block text-sm">New D&D Adventure Released</Text>
                  <Text className="text-gray-400 text-xs mb-2">
                    Wizards announces new campaign module for 2025
                  </Text>
                  <Badge color="gray" size="1">5 hours ago</Badge>
                </div>
                <Separator className="bg-gray-700" />
                <div>
                  <Text className="text-white font-semibold mb-1 block text-sm">Critical Role Returns</Text>
                  <Text className="text-gray-400 text-xs mb-2">
                    Campaign 4 premiere date announced
                  </Text>
                  <Badge color="gray" size="1">2 days ago</Badge>
                </div>
                <Separator className="bg-gray-700" />
                <div>
                  <Text className="text-white font-semibold mb-1 block text-sm">QuiverDM Update</Text>
                  <Text className="text-gray-400 text-xs mb-2">
                    Enhanced transcription now available with improved speaker detection
                  </Text>
                  <Badge color="purple" size="1">1 week ago</Badge>
                </div>
              </div>
            </Card>

            {/* Stats Card */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6">
              <Heading size="4" className="text-white mb-4">Your Stats</Heading>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Text className="text-gray-400">Total Campaigns</Text>
                  <Text className="text-white font-bold text-lg">{campaigns.length}</Text>
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex justify-between items-center">
                  <Text className="text-gray-400">Total Sessions</Text>
                  <Text className="text-white font-bold text-lg">
                    {campaigns.reduce((sum, c) => sum + (c._count?.gameSessions || 0), 0)}
                  </Text>
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex justify-between items-center">
                  <Text className="text-gray-400">Total NPCs</Text>
                  <Text className="text-white font-bold text-lg">
                    {campaigns.reduce((sum, c) => sum + (c._count?.npcs || 0), 0)}
                  </Text>
                </div>
                <Separator className="bg-gray-700" />
                <div className="flex justify-between items-center">
                  <Text className="text-gray-400">Players</Text>
                  <Text className="text-white font-bold text-lg">
                    {campaigns.reduce((sum, c) => sum + (c._count?.players || 0), 0)}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
