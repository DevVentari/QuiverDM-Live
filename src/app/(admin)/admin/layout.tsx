import type { Metadata } from 'next';
import { PlatformRole } from '@prisma/client';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, Sparkles } from 'lucide-react';
import { AdminNav } from '@/components/admin/admin-nav';
import { RoleBadge } from '@/components/ui/role-badge';
import { auth } from '@/lib/auth';
import { hasMinimumRole } from '@/lib/platform';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: {
    default: 'Admin',
    template: '%s | QuiverDM Admin',
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      name: true,
      platformRole: true,
    },
  });

  if (!user || !hasMinimumRole(user.platformRole, PlatformRole.WARDEN)) {
    redirect('/dashboard');
  }

  const displayName = user.displayName ?? user.name ?? 'Unknown admin';

  return (
    <div className="dashboard-bg min-h-screen bg-background text-foreground">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_26%),linear-gradient(180deg,rgba(7,10,18,0.96),rgba(7,10,18,0.92))]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <aside className="border-b border-[var(--q-border)] bg-[var(--q-surface-inset)] backdrop-blur lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
            <div className="space-y-6 p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-serif text-lg tracking-wide text-foreground">Platform Console</p>
                    <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
                      Outside The Player App
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--q-border)] bg-[var(--q-surface-inset)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.24em] text-[var(--q-text-dim)]">
                      Signed In
                    </span>
                    <RoleBadge role={user.platformRole} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="mt-1 text-xs text-[var(--q-text-dim)]">
                    Platform-only controls, account authority, and database-backed usage visibility.
                  </p>
                </div>
              </div>

              <AdminNav role={user.platformRole} />

              <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-4 text-sm text-[var(--q-text-dim)]">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Admin Boundary</span>
                </div>
                <p>Use this surface for platform operations only. Regular campaign work stays in the main archive.</p>
                <Link
                  href="/dashboard"
                  className="mt-3 inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Return to dashboard
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
