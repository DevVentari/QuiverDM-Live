import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';
import { AdminNav } from '@/components/admin/admin-nav';

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
      <div className="flex">
        <AdminNav role={user.platformRole} />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
