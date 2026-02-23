import { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password - QuiverDM',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
