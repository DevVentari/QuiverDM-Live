/**
 * QuiverDM v3 feature flag.
 *
 * The v3 redesign is built in parallel under `/v3/*` (`src/app/v3/`). The live
 * `(app)` tree is untouched and the persona/workflow gate (`qa:cycle`) keeps
 * running against it. Testers opt into v3 via the `qdm_v3` cookie; once a screen
 * is migrated its canonical path is added to `MIGRATED_ROUTES`, and the
 * middleware rewrites that path to its `/v3` equivalent for opted-in users.
 *
 * Isomorphic by design — safe to import from edge middleware, server, or client.
 */

export const QDM_V3_COOKIE = 'qdm_v3';

/** Build-wide enablement (e.g. preview deploys). Off by default. */
export function isV3BuildEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_QDM_V3;
  return v === '1' || v === 'true';
}

/**
 * Canonical app paths that have been cut over to v3. EMPTY during Foundation —
 * testers reach v3 only via explicit `/v3/...` URLs until a screen is migrated.
 * Add the canonical path (e.g. `'/campaigns'`) here to flip it for cookie users.
 */
export const MIGRATED_ROUTES: readonly string[] = [];

/** True when `pathname` is under a migrated route (exact or nested). */
export function isMigratedPath(pathname: string): boolean {
  return MIGRATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** True when a request should be rewritten from its canonical path into `/v3`. */
export function shouldRewriteToV3(pathname: string, hasV3Cookie: boolean): boolean {
  if (pathname.startsWith('/v3')) return false;
  if (!hasV3Cookie && !isV3BuildEnabled()) return false;
  return isMigratedPath(pathname);
}
