import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
