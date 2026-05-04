import { redirect } from 'next/navigation';

export default function NewCharacterRedirect() {
  redirect('/characters?create=true');
}
