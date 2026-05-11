'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const requestReset = trpc.passwordReset.requestReset.useMutation({
    onSuccess: () => setSent(true),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestReset.mutate({ email });
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mb-2 block font-display text-2xl font-bold text-foreground">
            QuiverDM
          </Link>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for {email}, we&apos;ve sent a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/signin" className="text-sm text-[var(--q-text-dim)] hover:text-foreground">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link href="/" className="mb-2 block font-display text-2xl font-bold text-foreground">
          QuiverDM
        </Link>
        <CardTitle className="text-xl">Forgot Password</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {requestReset.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-[var(--q-text-danger)]">
              {requestReset.error.message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={requestReset.isPending}>
            {requestReset.isPending ? 'Sending...' : 'Send reset link'}
          </Button>
          <p className="text-center text-sm text-[var(--q-text-dim)]">
            <Link href="/auth/signin" className="hover:text-foreground">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
