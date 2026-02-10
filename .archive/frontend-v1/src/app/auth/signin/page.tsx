'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push(callbackUrl);
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

      {/* Sign In Card */}
      <div className="w-full max-w-md bg-cream-white border border-cream-border rounded-2xl p-8 shadow-xl shadow-black/20 relative">
        {/* Decorative corner */}
        <div className="absolute top-3 right-3 text-accent-warm/20 text-2xl">❧</div>

        <h1 className="text-2xl font-display text-text-primary text-center mb-6">
          Welcome Back, Adventurer
        </h1>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 text-sm rounded-lg p-3 mb-4 text-center font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-warm hover:bg-accent-light text-cream-bg font-display py-3 rounded-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 mt-2"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-text-secondary font-body">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-accent-warm hover:text-accent-light font-display transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream-bg flex items-center justify-center">
        <div className="text-text-secondary font-body">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
