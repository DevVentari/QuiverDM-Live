import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { V3AppShell } from '@/components/shell/v3/V3AppShell';

export const metadata: Metadata = {
  title: {
    default: 'QuiverDM v3',
    template: '%s | QuiverDM',
  },
};

/**
 * Layout for the flag-gated v3 surfaces. Mirrors `(app)/layout.tsx` (auth gate
 * + shell) but mounts the parallel v3 shell. Inherits the tRPC `<Providers>`
 * from the root layout, so client components here use trpc/campaign-context
 * unchanged. The `(app)` tree is untouched.
 */
export default async function V3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return <V3AppShell>{children}</V3AppShell>;
}
