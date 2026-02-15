import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - QuiverDM',
  description: 'Administrative dashboard',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
