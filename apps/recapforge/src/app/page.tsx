import { QUEUE_NAMES } from '@quiverdm/shared';

export default function Home() {
  // Import proves workspace resolution; the value is intentionally unused in the UI.
  void QUEUE_NAMES;
  return (
    <main style={{ padding: '4rem 2rem', fontFamily: 'var(--qd-font-display)' }}>
      <h1>RecapForge</h1>
      <p style={{ fontFamily: 'var(--qd-font-body)', opacity: 0.8 }}>
        The chronicle awaits its first session.
      </p>
    </main>
  );
}
