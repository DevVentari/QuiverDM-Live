'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError('The tome does not recognize those words. Check your email and password.');
      return;
    }
    router.push(params.get('callbackUrl') ?? '/');
    router.refresh();
  }

  return (
    <main data-testid="signin-page" style={{ maxWidth: 420, margin: '10vh auto', padding: '0 1rem' }}>
      <h1 style={{ fontFamily: 'var(--qd-font-display)' }}>RecapForge</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', marginTop: '2rem' }}>
        <input
          data-testid="signin-email"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ minHeight: 44 }}
        />
        <input
          data-testid="signin-password"
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ minHeight: 44 }}
        />
        {error && <p data-testid="signin-error" role="alert">{error}</p>}
        <button data-testid="signin-submit" type="submit" style={{ minHeight: 44 }}>
          Enter
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        New here? <a href="/auth/signup">Begin your chronicle</a>
      </p>
    </main>
  );
}
