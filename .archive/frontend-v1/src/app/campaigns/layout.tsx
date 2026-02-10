import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect unauthenticated users to signin
  if (!session) {
    redirect('/auth/signin');
  }

  return <>{children}</>;
}
