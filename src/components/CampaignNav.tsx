'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Flex, Text, Button } from '@radix-ui/themes';
import { Home, Users, Scroll, Book, ArrowLeft, FolderOpen } from 'lucide-react';

interface CampaignNavProps {
  campaignId: string;
}

export default function CampaignNav({ campaignId }: CampaignNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: `/campaigns/${campaignId}`,
      label: 'Overview',
      icon: Home,
      match: (path: string) => path === `/campaigns/${campaignId}`,
    },
    {
      href: `/campaigns/${campaignId}/sessions`,
      label: 'Sessions',
      icon: Scroll,
      match: (path: string) => path.startsWith(`/campaigns/${campaignId}/sessions`),
    },
    {
      href: `/campaigns/${campaignId}/npcs`,
      label: 'NPCs',
      icon: Users,
      match: (path: string) => path.startsWith(`/campaigns/${campaignId}/npcs`),
    },
    {
      href: `/campaigns/${campaignId}/players`,
      label: 'Players',
      icon: Users,
      match: (path: string) => path.startsWith(`/campaigns/${campaignId}/players`),
    },
    {
      href: `/campaigns/${campaignId}/homebrew`,
      label: 'Homebrew',
      icon: Book,
      match: (path: string) => path.startsWith(`/campaigns/${campaignId}/homebrew`),
    },
  ];

  return (
    <Flex direction="column" gap="3" mb="6">
      {/* Back to Campaigns Link */}
      <Link href="/campaigns" style={{ textDecoration: 'none', width: 'fit-content' }}>
        <Flex
          align="center"
          gap="2"
          px="2"
          py="1"
          style={{
            cursor: 'pointer',
            color: 'var(--gray-11)',
            transition: 'color 0.2s',
          }}
          className="back-to-campaigns"
        >
          <ArrowLeft size={14} />
          <Text size="1" weight="medium">
            Back to Campaigns
          </Text>
        </Flex>
      </Link>

      {/* Campaign Navigation Tabs */}
      <Flex
        gap="1"
        style={{
          borderBottom: '1px solid var(--gray-6)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname ? item.match(pathname) : false;

          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <Flex
                align="center"
                gap="2"
                px="4"
                py="3"
                style={{
                  cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--violet-9)' : '2px solid transparent',
                  color: isActive ? 'var(--violet-11)' : 'var(--gray-11)',
                  transition: 'all 0.2s',
                }}
                className="nav-item"
              >
                <Icon size={16} />
                <Text size="2" weight={isActive ? 'bold' : 'medium'}>
                  {item.label}
                </Text>
              </Flex>
            </Link>
          );
        })}

        <style jsx global>{`
          .nav-item:hover {
            color: var(--violet-11) !important;
            background-color: var(--gray-2);
          }
          .back-to-campaigns:hover {
            color: var(--violet-11) !important;
          }
        `}</style>
      </Flex>
    </Flex>
  );
}
