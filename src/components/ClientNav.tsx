'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Flex, Text, DropdownMenu, Avatar, Button } from '@radix-ui/themes';
import { Home, Settings, LogOut, User, Users, UserPlus } from 'lucide-react';
import type { Session } from 'next-auth';

interface ClientNavProps {
  session: Session;
}

export function ClientNav({ session }: ClientNavProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!session.user?.name) return session.user?.email?.[0]?.toUpperCase() || 'U';

    const names = session.user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--gray-6)',
        backgroundColor: 'var(--color-background)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Flex
        justify="between"
        align="center"
        px="6"
        py="3"
        style={{ maxWidth: '1400px', margin: '0 auto' }}
      >
        {/* Logo / Brand */}
        <Link href="/campaigns" style={{ textDecoration: 'none' }}>
          <Flex align="center" gap="2" style={{ cursor: 'pointer' }}>
            <Text size="5" weight="bold" style={{ color: 'var(--violet-11)' }}>
              🎲 QuiverDM
            </Text>
          </Flex>
        </Link>

        <Flex align="center" gap="6">
          {/* Navigation Links */}
          <Flex align="center" gap="4">
            <Link href="/campaigns" style={{ textDecoration: 'none' }}>
              <Flex
                align="center"
                gap="2"
                px="3"
                py="2"
                style={{
                  cursor: 'pointer',
                  color: pathname?.startsWith('/campaigns') ? 'var(--violet-11)' : 'var(--gray-11)',
                  transition: 'color 0.2s',
                  borderRadius: '6px',
                }}
                className="nav-link"
              >
                <Home size={18} />
                <Text size="2" weight="medium">
                  Campaigns
                </Text>
              </Flex>
            </Link>

            <Link href="/characters" style={{ textDecoration: 'none' }}>
              <Flex
                align="center"
                gap="2"
                px="3"
                py="2"
                style={{
                  cursor: 'pointer',
                  color: pathname?.startsWith('/characters') ? 'var(--violet-11)' : 'var(--gray-11)',
                  transition: 'color 0.2s',
                  borderRadius: '6px',
                }}
                className="nav-link"
              >
                <Users size={18} />
                <Text size="2" weight="medium">
                  Characters
                </Text>
              </Flex>
            </Link>

            <Link href="/join" style={{ textDecoration: 'none' }}>
              <Flex
                align="center"
                gap="2"
                px="3"
                py="2"
                style={{
                  cursor: 'pointer',
                  color: pathname === '/join' ? 'var(--violet-11)' : 'var(--gray-11)',
                  transition: 'color 0.2s',
                  borderRadius: '6px',
                }}
                className="nav-link"
              >
                <UserPlus size={18} />
                <Text size="2" weight="medium">
                  Join
                </Text>
              </Flex>
            </Link>
          </Flex>

          {/* User Profile Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                className="user-menu-trigger"
              >
                <Avatar
                  src={session.user?.image || undefined}
                  fallback={getUserInitials()}
                  size="2"
                  radius="full"
                />
                <Flex direction="column" gap="0" style={{ maxWidth: '150px', textAlign: 'left' }}>
                  <Text size="2" weight="medium" style={{ lineHeight: '1.2' }}>
                    {session.user?.name || 'User'}
                  </Text>
                  <Text size="1" style={{ color: 'var(--gray-10)', lineHeight: '1.2' }}>
                    {session.user?.email}
                  </Text>
                </Flex>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
              <DropdownMenu.Label>
                <Text size="1" style={{ color: 'var(--gray-11)' }}>
                  {session.user?.email}
                </Text>
              </DropdownMenu.Label>

              <DropdownMenu.Separator />

              <DropdownMenu.Item>
                <Link href="/settings" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit' }}>
                  <Settings size={16} />
                  <span>Settings</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item>
                <Link href="/settings/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit' }}>
                  <User size={16} />
                  <span>Profile</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                onClick={handleSignOut}
                style={{ color: 'var(--red-11)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
      </Flex>

      <style jsx global>{`
        .nav-link:hover {
          color: var(--violet-11) !important;
          background-color: var(--gray-3);
        }
        .user-menu-trigger:hover {
          background-color: var(--gray-3);
        }
      `}</style>
    </nav>
  );
}
