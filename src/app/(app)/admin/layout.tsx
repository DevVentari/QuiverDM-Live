import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Admin - QuiverDM',
  description: 'Administrative dashboard',
};

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? '';

  if (!adminEmails.includes(email)) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
