import type { ReactNode } from 'react';

/**
 * The running chrome that sits atop every working document (ledger, composing
 * room, galley). Wordmark on the left, a flexible middle (nav or breadcrumb),
 * and an optional right slot pushed to the far edge.
 */
export function Masthead({
  children,
  right,
}: {
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="rf-masthead">
      <div className="rf-masthead__mark">RecapForge</div>
      <div className="rf-masthead__div" aria-hidden />
      {children}
      <div className="rf-masthead__spacer" />
      {right}
    </div>
  );
}
