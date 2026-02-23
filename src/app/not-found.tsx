import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <Compass className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist or has been moved.</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
