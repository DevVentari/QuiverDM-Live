import { auth } from '@/lib/auth';
import Link from 'next/link';
import { ClientNav } from '@/components/ClientNav';

export default async function GlobalNav() {
  const session = await auth();

  // Don't show nav on auth pages or marketing page
  // You can customize this logic as needed

  // If not authenticated, don't show the nav
  if (!session) {
    return null;
  }

  return <ClientNav session={session} />;
}
