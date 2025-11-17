// Force dynamic rendering for all auth pages
// These pages use useSession, useSearchParams and other client-only hooks
export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
