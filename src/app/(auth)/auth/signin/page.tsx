import { Metadata } from 'next';
import { SignInForm } from './signin-form';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Sign In — QuiverDM',
  description: 'Sign in to your QuiverDM account.',
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
