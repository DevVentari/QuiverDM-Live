'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong.');
      return;
    }
    await signIn('credentials', { email, password, redirect: false });
    router.push('/');
    router.refresh();
  }

  return (
    <main data-testid="signup-page" style={{ maxWidth: 420, margin: '10vh auto', padding: '0 1rem' }}>
      <h1 style={{ fontFamily: 'var(--qd-font-display)' }}>Begin your chronicle</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', marginTop: '2rem' }}>
        <input data-testid="signup-name" required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ minHeight: 44 }} />
        <input data-testid="signup-email" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minHeight: 44 }} />
        <input data-testid="signup-password" type="password" required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ minHeight: 44 }} />
        {error && <p data-testid="signup-error" role="alert">{error}</p>}
        <button data-testid="signup-submit" type="submit" style={{ minHeight: 44 }}>Forge account</button>
      </form>
    </main>
  );
}
