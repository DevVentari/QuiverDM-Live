# RecapForge Standalone — Deploy Runbook

App: apps/recapforge · PM2: `recapforge` · Port 3005 · Host: recap.quiverdm.com

## One-time setup
1. **DNS:** add `recap.quiverdm.com` A/CNAME to the same edge as quiverdm.com.
2. **Caddy (homelab):** add to the Caddyfile:
   ```
   recap.quiverdm.com {
       reverse_proxy 192.168.1.21:3005
   }
   ```
   then `systemctl reload caddy` (or the container's reload command).
3. **Discord OAuth:** in the Discord developer portal, add redirect URI
   `https://recap.quiverdm.com/api/auth/callback/discord`.
4. **Env on homelab:** create `/opt/quiverdm/apps/recapforge/.env` with
   `DATABASE_URL`, `NEXTAUTH_URL=https://recap.quiverdm.com`,
   `NEXTAUTH_SECRET` (same as main app), `AUTH_COOKIE_DOMAIN=.quiverdm.com`,
   `DISCORD_CLIENT_ID/SECRET`.

## Every deploy
`bash /opt/quiverdm/deploy/homelab/deploy.sh` (now builds + restarts recapforge too).

## Verify
- `curl -s https://recap.quiverdm.com/api/health` → `{"ok":true,"app":"recapforge"}`
- Sign in on recap.quiverdm.com with an existing QuiverDM account.
- After first deploy, exercise a DB-touching route (e.g. `POST /api/signup` with a
  throwaway account) or check `pm2 logs recapforge` for PrismaClient init errors, to
  confirm the hoisted Prisma client resolves from `apps/recapforge` in the deployed
  layout.

## Merge-back normalization checklist

When folding recapforge's auth code back into the main app (or vice versa), these
divergences need to be reconciled — tracked here so they aren't lost between the
standalone spike and the merge:

- **Open-redirect parity bug:** validate `callbackUrl` on signin (require
  `startsWith('/')` and `!startsWith('//')`) in BOTH apps — one currently accepts
  unvalidated redirect targets.
- **User-enumeration parity:** normalize signup responses in both apps so a
  duplicate-email attempt and a fresh signup return indistinguishable errors/timing.
- **bcrypt cost parity:** normalize the bcrypt hashing cost (12 vs 10 today) between
  the two apps, and share the auth cookie config so the main app can read sessions
  issued under `.quiverdm.com`.
- **Signup race (TOCTOU):** catch Prisma `P2002` (unique constraint) in recapforge's
  signup handler and return `409 Conflict` instead of a generic 500 when two signups
  race on the same email.
- **Middleware prefix tightening:** tighten recapforge's middleware public-path
  matching to `/auth/` plus exact matches, rather than broad prefix matching that
  could unintentionally expose adjacent routes.
- **Playwright serial mode:** add `test.describe.configure({ mode: 'serial' })` to
  the shell spec if `apps/recapforge/playwright.config.ts` ever moves to multiple
  workers — the signup/signin tests currently rely on running in a fixed single-worker
  order.
