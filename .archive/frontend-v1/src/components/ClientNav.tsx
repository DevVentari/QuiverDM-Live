'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Flex, Text, DropdownMenu, Avatar } from '@radix-ui/themes';
import { Home, Settings, LogOut, User, Users, UserPlus } from 'lucide-react';
import type { Session } from 'next-auth';
import { Button } from '@/components/ui/Button';

interface ClientNavProps {
  session: Session;
}

export function ClientNav({ session }: ClientNavProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const getUserInitials = () => {
    if (!session.user?.name) return session.user?.email?.[0]?.toUpperCase() || 'U';

    const names = session.user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  return (
    <nav className="bg-cream-white border-b border-cream-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex-shrink-0">
            <Link href="/campaigns" className="flex items-center space-x-2">
              <span className="text-2xl font-display text-accent-warm">🏹</span>
              <span className="font-display text-xl text-text-primary">QuiverDM</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link href="/campaigns">
                <Button variant={pathname?.startsWith('/campaigns') ? 'secondary' : 'ghost'}>
                  <Home size={18} className="mr-2" />
                  Campaigns
                </Button>
              </Link>
              <Link href="/characters">
                <Button variant={pathname?.startsWith('/characters') ? 'secondary' : 'ghost'}>
                  <Users size={18} className="mr-2" />
                  Characters
                </Button>
              </Link>
              <Link href="/join">
                <Button variant={pathname === '/join' ? 'secondary' : 'ghost'}>
                  <UserPlus size={18} className="mr-2" />
                  Join
                </Button>
              </Link>
            </div>
          </div>

          {/* User Profile Dropdown */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <button
                    type="button"
                    className="flex items-center px-3 py-2 rounded-md hover:bg-cream-light transition-colors"
                  >
                    <Avatar
                      src={session.user?.image || undefined}
                      fallback={getUserInitials()}
                      size="2"
                      radius="full"
                    />
                    <div className="ml-3 text-left">
                      <p className="text-sm font-medium text-text-primary">{session.user?.name || 'User'}</p>
                      <p className="text-xs font-medium text-text-secondary">{session.user?.email}</p>
                    </div>
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content>
                  <DropdownMenu.Label>
                    <Text size="1" className="text-text-secondary">
                      {session.user?.email}
                    </Text>
                  </DropdownMenu.Label>

                  <DropdownMenu.Separator />

                  <DropdownMenu.Item asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings size={16} className="mr-2" />
                      Settings
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <Link href="/settings/profile" className="flex items-center">
                      <User size={16} className="mr-2" />
                      Profile
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator />

                  <DropdownMenu.Item
                    onClick={handleSignOut}
                    className="text-red-500"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

