'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const validate = trpc.passwordReset.validateToken.useQuery({ token });
  const resetPassword = trpc.passwordReset.resetPassword.useMutation({
    onSuccess: () => router.push('/auth/signin?reset=success'),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    resetPassword.mutate({ token, password });
  }

  if (validate.isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Validating reset link...
        </CardContent>
      </Card>
    );
  }

  if (!validate.data?.valid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Link expired</CardTitle>
          <CardDescription>This reset link is invalid or has expired.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
            Request a new reset link
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
        <CardTitle className="text-xl">Set new password</CardTitle>
        <CardDescription>Choose a password with at least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(localError || resetPassword.error) && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {localError || resetPassword.error?.message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? 'Saving...' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
