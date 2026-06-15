/**
 * QDM_V3 feature flag + per-route migration allowlist.
 *
 * Two independent switches gate the v3 build:
 *  1. `NEXT_PUBLIC_QDM_V3` — build-wide opt-in (default off everywhere).
 *  2. a per-user `qdm_v3` cookie — lets a tester opt in without a rebuild.
 *
 * When v3 is enabled AND the requested path is in `MIGRATED_ROUTES`, the
 * middleware rewrites the canonical URL (e.g. `/campaigns/x`) to its `/v3`
 * equivalent. Until a screen is added to the allowlist, default traffic — and
 * the `qa:cycle` gate — keeps hitting the untouched `(app)` tree.
 */

/** Cookie name a tester sets to opt into the v3 surfaces. */
export const V3_COOKIE = 'qdm_v3'

/** Build-wide flag. `NEXT_PUBLIC_` so it is readable on client and edge. */
export const V3_BUILD_FLAG = process.env.NEXT_PUBLIC_QDM_V3 === '1'

/**
 * Canonical app paths that have been migrated and should rewrite to `/v3/...`.
 * Empty until a screen passes its v3 Playwright spec. Matched as path prefixes,
 * so `/campaigns` covers `/campaigns/acme/sessions`.
 */
export const MIGRATED_ROUTES: readonly string[] = []

/** True when the v3 cookie value indicates opt-in. */
export function hasV3Cookie(cookieValue: string | undefined): boolean {
  return cookieValue === '1' || cookieValue === 'true'
}

/** Whether v3 is enabled for this request (build flag OR opted-in cookie). */
export function isV3Enabled(cookieValue: string | undefined): boolean {
  return V3_BUILD_FLAG || hasV3Cookie(cookieValue)
}

/** Whether a given canonical path has been migrated to a `/v3` surface. */
export function isMigratedRoute(pathname: string): boolean {
  return MIGRATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

/**
 * Resolve whether a request should be rewritten to its `/v3` equivalent.
 * Returns the rewritten pathname, or null to leave the request untouched.
 * Never rewrites a path that is already under `/v3`.
 */
export function resolveV3Rewrite(
  pathname: string,
  cookieValue: string | undefined,
): string | null {
  if (pathname.startsWith('/v3')) return null
  if (!isV3Enabled(cookieValue)) return null
  if (!isMigratedRoute(pathname)) return null
  return `/v3${pathname}`
}
