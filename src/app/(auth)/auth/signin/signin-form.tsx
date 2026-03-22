'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="stone-card-title mb-1">Sign In</div>
      <div className="section-rule mb-6" />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="label-overline block">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="dm@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label-overline">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-0 top-0 h-full px-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          <LogIn className="h-3.5 w-3.5" />
          {loading ? 'Signing in...' : 'Enter the Realm'}
        </Button>
      </form>

      <div
        className="mt-8 pt-5 text-center text-xs border-t"
        style={{ borderColor: 'hsl(35 35% 13%)', color: 'hsl(35 10% 40%)' }}
      >
        No account?{' '}
        <Link href="/auth/signup" className="text-primary font-semibold hover:underline">
          Request access
        </Link>
      </div>
    </div>
  );
}
