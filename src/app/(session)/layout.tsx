import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
