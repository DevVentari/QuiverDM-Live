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
