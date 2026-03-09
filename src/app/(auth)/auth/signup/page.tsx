import { Metadata } from 'next';
import { SignUpForm } from './signup-form';
import { PortalScene } from '@/components/auth/portal-scene';

export const metadata: Metadata = {
  title: 'Create Account — QuiverDM',
  description: 'Create your QuiverDM account and start managing your D&D campaigns.',
};

export default function SignUpPage() {
  return (
    <PortalScene>
      <SignUpForm />
    </PortalScene>
  );
}
