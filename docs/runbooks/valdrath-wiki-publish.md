# Runbook — Valdrath wiki publish (CT 204)

One-time setup so RecapForge (CT 206) can publish `session-N.html` to
valdrath.quiverdm.com. After this, publishing is a button in /recap.

## 1. Generic dir-serve (nginx on CT 204, docroot /srv/valdrath)
**ALREADY DONE (2026-07-13).** Do NOT blindly overwrite `/etc/nginx/sites-available/valdrath` —
the same server block ALSO serves the campaign **wiki** at `/wiki/` (a separate Astro
static site in `/srv/valdrath/wiki`). Overwriting with the session-only block below
would **clobber the wiki**. The live config (source of truth, keep both) is:
```nginx
server {
    listen 8092; server_name _; root /srv/valdrath; absolute_redirect off;
    location = / { add_header Cache-Control "no-cache, must-revalidate"; try_files /index.html =404; }
    location = /wiki { return 302 /wiki/; }
    location /wiki/ { add_header Cache-Control "no-cache, must-revalidate"; try_files $uri $uri/index.html $uri.html =404; }
    location /    { add_header Cache-Control "no-cache, must-revalidate"; try_files $uri $uri.html =404; }
    gzip on; gzip_types text/plain text/css application/javascript image/svg+xml;
}
```
The RecapForge publish path only needs the two generic `location` blocks (`= /` + `/`);
the `/wiki` blocks belong to the separate valdrath-wiki project — preserve them.
Validate with `nginx -t`, then `systemctl reload nginx` (reload, not restart).

## 2. Receiver user + forced command
```bash
pct exec 204 -- useradd -m -G www-data valdrath-recv
# install the script:
pct push 204 deploy/homelab/valdrath-recv.sh /usr/local/bin/valdrath-recv
pct exec 204 -- chmod 755 /usr/local/bin/valdrath-recv
# make the docroot group-writable + setgid so writes are nginx-readable, no sudo:
pct exec 204 -- chgrp www-data /srv/valdrath
pct exec 204 -- chmod 2775 /srv/valdrath
```

## 3. Keypair + authorized_keys
```bash
ssh-keygen -t ed25519 -f ./valdrath-recv -C recap-publish -N ''
# authorized_keys on CT 204 (~valdrath-recv/.ssh/authorized_keys), one line:
command="/usr/local/bin/valdrath-recv",no-pty,no-port-forwarding,no-x11-forwarding,no-agent-forwarding <contents of valdrath-recv.pub>
# private key → RecapForge env on CT 206 (RECAP_PUBLISH_SSH_KEY) + Vaultwarden.
# pin CT 204 host key:
ssh-keyscan -t ed25519 192.168.1.15   # → RECAP_PUBLISH_KNOWN_HOSTS
```

## 4. Seed the campaign + deploy
```bash
npx tsx scripts/seed-valdrath-publish-config.ts
# deploy RecapForge (CT 206) per quiverdm-deploy; set RECAP_PUBLISH_SSH_KEY + RECAP_PUBLISH_KNOWN_HOSTS.
```

## 5. Manual E2E (ship-time gate)
```bash
# In /recap for a ready Valdrath recap → click "Publish to the wiki".
curl -sI https://valdrath.quiverdm.com/session-N   # → 200
# Open it; confirm the recap renders + mobile has 0 overflow at 320/375/390.
```

## Manual Guard Assertion
The bash guard is not unit-tested in vitest (cross-platform bash-in-Node is flaky on Windows). 
Instead, verify manually on any machine with bash:

### Valid numeric session number (success case)
```bash
VALDRATH_DIR=$(mktemp -d) SSH_ORIGINAL_COMMAND='5' bash deploy/homelab/valdrath-recv.sh <<< '<html>ok</html>'
```
**Expected:** prints "published session-5"; `$VALDRATH_DIR/session-5.html` + `index.html` exist

### Invalid path with traversal attempt (reject case)
```bash
VALDRATH_DIR=$(mktemp -d) SSH_ORIGINAL_COMMAND='../evil' bash deploy/homelab/valdrath-recv.sh <<< 'x'
```
**Expected:** prints "bad session number" to stderr, exit code 1, no files written
