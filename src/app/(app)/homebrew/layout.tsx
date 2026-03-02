import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Homebrew Library' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
