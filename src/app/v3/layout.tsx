import { type Metadata } from 'next';
import { Kalam, Hanken_Grotesk } from 'next/font/google';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { V3AppShell } from '@/components/shell/v3/V3AppShell';
import '../../styles/v3-tokens.css';
import '../../styles/v3.css';

// v3 type system (design-system handoff): Kalam display + Hanken Grotesk body.
const kalam = Kalam({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-kalam',
  display: 'swap',
});
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'v3',
    template: '%s | QuiverDM v3',
  },
};

/**
 * Layout for the parallel v3 tree (`/v3/*`). Mirrors the auth guard of the live
 * `(app)` layout and wraps everything in the V3AppShell. The `.v3-scope` wrapper
 * binds the Kalam/Hanken fonts to the `--qd-*` token system; the atmospheric
 * background comes from the root layout.
 */
export default async function V3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/v3');
  }

  return (
    <div className={`v3-scope ${kalam.variable} ${hanken.variable}`}>
      <V3AppShell>{children}</V3AppShell>
    </div>
  );
}
