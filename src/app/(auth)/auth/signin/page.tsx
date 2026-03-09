import { Metadata } from 'next';
import { SignInForm } from './signin-form';
import { Suspense } from 'react';
import { PortalScene } from '@/components/auth/portal-scene';

export const metadata: Metadata = {
  title: 'Sign In — QuiverDM',
  description: 'Sign in to your QuiverDM account.',
};

export default function SignInPage() {
  return (
    <PortalScene>
      <Suspense>
        <SignInForm />
      </Suspense>
    </PortalScene>
  );
}
