'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      // Auto-signin after successful signup
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but failed to sign in. Please try signing in manually.');
      } else {
        // Redirect to campaigns with onboarding flag
        router.push('/campaigns?onboarding=true');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-bg flex flex-col items-center justify-center p-4">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent-warm/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-warm/5 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <Link href="/" className="flex items-center space-x-3 mb-8 relative">
        <span className="text-4xl">🏹</span>
        <span className="text-2xl font-display text-text-primary">QuiverDM</span>
      </Link>

      {/* Sign Up Card */}
      <div className="w-full max-w-md bg-cream-white border border-cream-border rounded-2xl p-8 shadow-xl shadow-black/20 relative">
        {/* Decorative corner */}
        <div className="absolute top-3 right-3 text-accent-warm/20 text-2xl">❧</div>

        <h1 className="text-2xl font-display text-text-primary text-center mb-6">
          Begin Your Adventure
        </h1>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 text-sm rounded-lg p-3 mb-4 text-center font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-display text-text-primary mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="w-full bg-cream-bg border border-cream-border rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary/50 font-body focus:outline-none focus:border-accent-warm transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-display text-text-primary mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full bg-cream-bg border border-cream-border rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary/50 font-body focus:outline-none focus:border-accent-warm transition-colors"
            />
          </div>

          <div>
            <label htmlFor="inviteCode" className="block text-sm font-display text-text-primary mb-2">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              placeholder="Your invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              disabled={isLoading}
              className="w-full bg-cream-bg border border-cream-border rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary/50 font-body focus:outline-none focus:border-accent-warm transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-display text-text-primary mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="w-full bg-cream-bg border border-cream-border rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary/50 font-body focus:outline-none focus:border-accent-warm transition-colors"
            />
            <p className="text-text-secondary/60 text-xs mt-1 font-body">At least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-warm hover:bg-accent-light text-cream-bg font-display py-3 rounded-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 mt-2"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign In Link */}
        <p className="text-center mt-6 text-text-secondary font-body">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-accent-warm hover:text-accent-light font-display transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
