#!/usr/bin/env bash
# Start the 6-hour autonomous QA overnight run on LXC 402.
# Usage: ./start-overnight.sh [--until-clean N] [--dry-run]
#
# Reads env from /opt/quiverdm/.env.qa if it exists.
# Run as: bash start-overnight.sh
# Or via systemd: systemctl start qa-overnight

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="/opt/quiverdm/.env.qa"

if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

export PYTHONUNBUFFERED=1

echo "[start-overnight] Starting QA orchestrator from $SCRIPT_DIR"
exec uv run python -u overnight.py --local "$@"
