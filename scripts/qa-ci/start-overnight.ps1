# start-overnight.ps1
# Single command to start the 6-hour autonomous QA run.
# Usage: cd scripts\qa-ci && .\start-overnight.ps1

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "Starting 6-hour autonomous QA run..."
Write-Host "Working directory: $ScriptDir"
Write-Host ""

# Verify uv is available
try {
    $uvVersion = & uv --version 2>&1
    Write-Host "uv: $uvVersion"
} catch {
    Write-Error "uv not found. Install from https://docs.astral.sh/uv/"
    exit 1
}

# Verify .env.local exists (needed for QA agent credentials)
$EnvLocal = Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) '.env.local'
if (-not (Test-Path $EnvLocal)) {
    Write-Warning ".env.local not found at $EnvLocal — QA agents may fail without credentials"
}

# overnight.py manages fix_dispatcher internally — just launch the orchestrator
Write-Host "Launching overnight orchestrator (foreground — shows progress)..."
Write-Host "Press Ctrl+C to stop early."
Write-Host ""

uv run python overnight.py

Write-Host ""
Write-Host "Overnight QA run complete."
