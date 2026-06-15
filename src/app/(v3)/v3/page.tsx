import Link from 'next/link';
import { Surface } from '@/components/primitives/Surface';

/**
 * /v3 landing — the flagged shell's placeholder home. Confirms the v3 tree,
 * shell, and Scrollkin perch render end-to-end before any screen is migrated.
 */
export default function V3LandingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--q-accent-primary)]">
          Parallel build
        </p>
        <h1 className="font-display text-3xl font-bold text-[var(--q-text)]">
          QuiverDM v3
        </h1>
        <p className="text-sm text-[var(--q-text-dim)]">
          You are on the flag-gated v3 surface. The current app is untouched; screens flip over
          here per-route as they are migrated.
        </p>
      </div>

      <Surface variant="feature" grain className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-[var(--q-text)]">Foundation status</h2>
        <ul className="space-y-1.5 text-sm text-[var(--q-text-dim)]">
          <li>· Shell + Scrollkin perch — mounted (bottom-right).</li>
          <li>· Scrollkin engine — predicate + line-pool layer in place.</li>
          <li>· Icon set + token reconciliation — pending design assets.</li>
        </ul>
        <Link
          href="/v3/dev/icons"
          className="mt-4 inline-block text-xs text-[var(--q-accent-primary)] underline-offset-2 hover:underline"
        >
          Icon gallery →
        </Link>
      </Surface>
    </div>
  );
}
