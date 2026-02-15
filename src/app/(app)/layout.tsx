import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from './app-shell';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s | QuiverDM',
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return <AppShell>{children}</AppShell>;
}
