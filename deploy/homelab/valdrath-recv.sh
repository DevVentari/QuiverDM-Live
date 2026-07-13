#!/bin/bash
# Forced-command receiver for the valdrath-recv user on CT 204.
# authorized_keys: command="/usr/local/bin/valdrath-recv",no-pty,no-port-forwarding,no-x11-forwarding,no-agent-forwarding <key>
# Writes /srv/valdrath/session-<n>.html from stdin and updates the latest pointer.
set -euo pipefail
dir="${VALDRATH_DIR:-/srv/valdrath}"
n="${SSH_ORIGINAL_COMMAND:-${1:-}}"
[[ "$n" =~ ^[0-9]+$ ]] || { echo "bad session number" >&2; exit 1; }
cat > "$dir/session-$n.html"
printf '<!doctype html><meta http-equiv="refresh" content="0;url=/session-%s">' "$n" > "$dir/index.html"
echo "published session-$n"
