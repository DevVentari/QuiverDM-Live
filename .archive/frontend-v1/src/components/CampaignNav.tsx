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
      <Link href="/campaigns" className="no-underline w-fit">
        <Flex
          align="center"
          gap="2"
          px="2"
          py="1"
          className="cursor-pointer text-text-primary transition-colors duration-200 hover:text-accent-dark"
        >
          <ArrowLeft size={14} />
          <Text size="1" weight="medium">
            Back to Campaigns
          </Text>
        </Flex>
      </Link>

      {/* Campaign Navigation Tabs */}
      <Flex gap="1" className="border-b border-b-cream-border">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname ? item.match(pathname) : false;

          return (
            <Link key={item.href} href={item.href} className="no-underline">
              <Flex
                align="center"
                gap="2"
                px="4"
                py="3"
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  isActive
                    ? "border-b-2 border-b-accent-dark text-accent-dark"
                    : "border-b-2 border-b-transparent text-text-primary hover:text-accent-dark hover:bg-cream-white"
                )}
              >
                <Icon size={16} />
                <Text size="2" weight={isActive ? 'bold' : 'medium'}>
                  {item.label}
                </Text>
              </Flex>
            </Link>
          );
        })}
      </Flex>
    </Flex>
  );
}
