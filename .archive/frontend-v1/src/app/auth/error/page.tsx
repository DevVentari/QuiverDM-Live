'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication. Please try again.',
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error') || 'Default';
  const message = errorMessages[error] || errorMessages.Default;

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: '1rem' }}
    >
      <Card style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <Flex direction="column" gap="4" align="center">
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--red-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--red-9)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          <Heading size="6" align="center">
            Authentication Error
          </Heading>

          <Text size="2" align="center" color="gray">
            {message}
          </Text>

          <Link href="/auth/signin" style={{ textDecoration: 'none', width: '100%' }}>
            <Button style={{ width: '100%' }}>Back to Sign In</Button>
          </Link>
        </Flex>
      </Card>
    </Flex>
  );
}
