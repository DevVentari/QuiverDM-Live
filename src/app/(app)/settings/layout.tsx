import { Metadata } from 'next';
import { SettingsShell } from '@/components/settings/settings-shell';

export const metadata: Metadata = { title: 'Settings' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
