import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from './app-shell';

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
