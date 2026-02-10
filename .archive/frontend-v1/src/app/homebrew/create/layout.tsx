// Force dynamic rendering for all homebrew creation pages
// These pages use useSession and other client-only hooks
export const dynamic = 'force-dynamic';

export default function HomebrewCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
