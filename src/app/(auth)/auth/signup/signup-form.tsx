'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created, but sign in failed. Please sign in manually.');
        setLoading(false);
        return;
      }

      router.push('/onboarding');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="stone-card-title mb-1">Create Account</div>
      <div className="section-rule mb-6" />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="name" className="label-overline block">
            Name
          </label>
          <Input
            id="name"
            placeholder="Dungeon Master"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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
          <label htmlFor="password" className="label-overline block">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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

        <div className="space-y-1.5">
          <label htmlFor="inviteCode" className="label-overline block">
            Invite Code
          </label>
          <Input
            id="inviteCode"
            placeholder="Enter your invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          <Shield className="h-3.5 w-3.5" />
          {loading ? 'Creating account...' : 'Join the Realm'}
        </Button>
      </form>

      <div
        className="mt-8 pt-5 text-center text-xs border-t"
        style={{ borderColor: 'hsl(35 35% 13%)', color: 'hsl(35 10% 40%)' }}
      >
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-primary font-semibold hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
