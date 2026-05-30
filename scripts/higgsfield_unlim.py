#!/usr/bin/env python3
"""
Higgsfield FLUX.2 free-queue generator.

Submits images to the low-priority (use_unlim=true) queue at no credit cost.
Uses a persistent Chromium profile so Clerk tokens (including httpOnly cookies)
are retained and auto-refreshed across runs.

First run: opens a headed browser for one-time Google OAuth login.
Subsequent runs: fully headless.

Requires: pip install playwright && playwright install chromium

Usage:
    python scripts/higgsfield_unlim.py "your prompt" [--aspect 4:3] [--res 2k] [--out file.png]
    python scripts/higgsfield_unlim.py "your prompt" --paid   # credit/priority queue
    python scripts/higgsfield_unlim.py --login               # force re-login
"""

import argparse
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────────

API_BASE  = "https://fnf.higgsfield.ai"
HF_ORIGIN = "https://higgsfield.ai"
HF_IMAGE_URL = "https://higgsfield.ai/ai/image?model=flux_2"

# Persistent Chromium profile — stores all cookies including httpOnly Clerk tokens
PROFILE_DIR = Path.home() / ".config" / "higgsfield-playwright" / "profile"

VALID_ASPECTS = {"1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"}
VALID_RES     = {"1k", "2k"}
ASPECT_DIMS   = {
    "1:1": (400, 400), "4:3": (400, 300), "3:4": (300, 400),
    "16:9": (400, 225), "9:16": (225, 400), "3:2": (400, 267), "2:3": (267, 400),
}


# ── Core logic ────────────────────────────────────────────────────────────────

def generate(prompt: str, aspect: str, res: str, use_unlim: bool) -> str:
    """Run everything inside a Playwright browser and return the image URL."""
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    w, h = ASPECT_DIMS.get(aspect, (300, 400))

    with sync_playwright() as p:
        logged_in = _is_logged_in(PROFILE_DIR)

        ctx = p.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=logged_in,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )

        page = ctx.new_page()

        print("  Loading Higgsfield...", file=sys.stderr)
        page.goto(HF_IMAGE_URL, wait_until="domcontentloaded", timeout=30_000)

        # Ensure logged in
        if not _wait_for_clerk(page):
            if logged_in:
                print("  Session expired — reopening headed browser for re-login...", file=sys.stderr)
                ctx.close()
                _delete_profile_marker()
                return generate(prompt, aspect, res, use_unlim)
            # First-time headed login
            print("\n  Not logged in. Please log in with Google in the browser window.", file=sys.stderr)
            page.wait_for_function(
                "() => window.Clerk && window.Clerk.session && window.Clerk.session.id",
                timeout=120_000,
            )
            _mark_logged_in(PROFILE_DIR)
            print("  Login saved.", file=sys.stderr)

        # Get a fresh Clerk JWT (auto-refreshed by Clerk JS)
        print("  Getting JWT...", file=sys.stderr)
        token = page.evaluate("async () => await window.Clerk.session.getToken()")
        if not token:
            ctx.close()
            sys.exit("Clerk returned no token. Delete ~/.config/higgsfield-playwright and re-run.")

        # Build payload
        payload = {
            "params": {
                "model": "pro", "resolution": res, "prompt": prompt,
                "batch_size": 1, "input_images": [],
                "width": w, "height": h, "steps": 30, "cfg": 5,
                "seed": random.randint(1, 999999), "aspect_ratio": aspect,
            },
            "use_unlim": use_unlim,
        }

        # Submit job via in-page fetch (bypasses Cloudflare/Datadome)
        # Read datadome cookie from the page to pass to fnf subdomain
        print("  Submitting job...", file=sys.stderr)
        result = page.evaluate(f"""async () => {{
            const datadome = document.cookie.split(';')
                .map(c => c.trim())
                .find(c => c.startsWith('datadome='));
            const resp = await fetch('{API_BASE}/jobs/flux-2', {{
                method: 'POST',
                headers: {{
                    'Authorization': 'Bearer {token}',
                    'Content-Type': 'application/json',
                    'Origin': '{HF_ORIGIN}',
                    'Referer': '{HF_ORIGIN}/',
                    ...(datadome ? {{'Cookie': datadome}} : {{}}),
                }},
                body: JSON.stringify({json.dumps(payload)}),
            }});
            const text = await resp.text();
            let body;
            try {{ body = JSON.parse(text); }} catch(e) {{ body = text.substring(0, 500); }}
            return {{ status: resp.status, body }};
        }}""")

        if result["status"] not in (200, 201):
            ctx.close()
            sys.exit(f"Job submission failed ({result['status']}): {result['body']}")

        body   = result["body"]
        job_id = body.get("id") or body.get("job_id") or (body.get("ids") or [None])[0]
        if not job_id:
            ctx.close()
            sys.exit(f"No job_id in response: {body}")

        print(f"  Job: {job_id}", file=sys.stderr)

        image_url = _poll(page, token, job_id)
        ctx.close()

    return image_url


def _poll(page, token: str, job_id: str, timeout: int = 600) -> str:
    """Poll job status via in-page fetch until done. Returns image URL."""
    deadline = time.time() + timeout

    while time.time() < deadline:
        result = page.evaluate(f"""async () => {{
            const datadome = document.cookie.split(';')
                .map(c => c.trim()).find(c => c.startsWith('datadome='));
            const resp = await fetch('{API_BASE}/jobs/{job_id}/status', {{
                headers: {{
                    'Authorization': 'Bearer {token}',
                    'Origin': '{HF_ORIGIN}',
                    'Referer': '{HF_ORIGIN}/',
                    ...(datadome ? {{'Cookie': datadome}} : {{}}),
                }},
            }});
            const text = await resp.text();
            let body;
            try {{ body = JSON.parse(text); }} catch(e) {{ body = text.substring(0, 200); }}
            return {{ status: resp.status, body }};
        }}""")

        if result["status"] != 200:
            print(f"  poll {result['status']}, retrying...", file=sys.stderr)
            time.sleep(5)
            continue

        body   = result["body"]
        status = (body.get("status") or "").lower()
        print(f"  [{status}]", file=sys.stderr)

        if status in ("completed", "done", "succeeded", "success"):
            url = (
                body.get("url")
                or body.get("output_url")
                or (body.get("assets") or [{}])[0].get("url")
            )
            if url:
                return url
            return _asset_detail(page, token, job_id)

        if status in ("failed", "error", "cancelled"):
            sys.exit(f"Job {job_id} ended: {status}\n{body}")

        time.sleep(5)

    sys.exit(f"Timed out after {timeout}s for job {job_id}")


def _asset_detail(page, token: str, job_id: str) -> str:
    result = page.evaluate(f"""async () => {{
        const resp = await fetch('{API_BASE}/assets/{job_id}/detail', {{
            headers: {{ 'Authorization': 'Bearer {token}', 'Origin': '{HF_ORIGIN}' }},
        }});
        return await resp.json();
    }}""")
    url = result.get("url") or result.get("output_url")
    if not url:
        sys.exit(f"Cannot extract URL from asset detail: {result}")
    return url


# ── Profile helpers ───────────────────────────────────────────────────────────

def _marker_path(profile_dir: Path) -> Path:
    return profile_dir / ".logged-in"

def _is_logged_in(profile_dir: Path) -> bool:
    return _marker_path(profile_dir).exists()

def _mark_logged_in(profile_dir: Path):
    _marker_path(profile_dir).touch()

def _delete_profile_marker():
    p = _marker_path(PROFILE_DIR)
    if p.exists():
        p.unlink()

def _wait_for_clerk(page, timeout: int = 10_000) -> bool:
    """Returns True if Clerk session is active within timeout."""
    from playwright.sync_api import TimeoutError as PWTimeout
    try:
        page.wait_for_function(
            "() => window.Clerk && window.Clerk.session && window.Clerk.session.id",
            timeout=timeout,
        )
        return True
    except PWTimeout:
        return False


# ── Download ──────────────────────────────────────────────────────────────────

def download(url: str, out_path: Path):
    with urllib.request.urlopen(url, timeout=60) as resp:
        out_path.write_bytes(resp.read())
    print(f"Saved → {out_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate FLUX.2 images via Higgsfield free queue (use_unlim=true)"
    )
    parser.add_argument("prompt", nargs="?", help="Image prompt")
    parser.add_argument(
        "--aspect", default="3:4", choices=sorted(VALID_ASPECTS), metavar="RATIO",
        help="Aspect ratio (default: 3:4)"
    )
    parser.add_argument(
        "--res", default="1k", choices=sorted(VALID_RES),
        help="Resolution: 1k or 2k (default: 1k)"
    )
    parser.add_argument("--paid", action="store_true",
                        help="Use credit/priority queue instead of free queue")
    parser.add_argument("--out", help="Download image to this file path")
    parser.add_argument("--login", action="store_true",
                        help="Force re-login (clears saved session)")
    args = parser.parse_args()

    if args.login:
        _delete_profile_marker()
        print("Session cleared. Re-run without --login to log in.", file=sys.stderr)
        # Fall through to generate if prompt provided
        if not args.prompt:
            return

    if not args.prompt:
        parser.print_help()
        sys.exit(1)

    use_unlim = not args.paid
    queue     = "PAID/priority" if args.paid else "FREE/low-priority"

    print(f"Queue:  {queue}", file=sys.stderr)
    print(f"Prompt: {args.prompt[:80]}", file=sys.stderr)
    print(f"Params: {args.aspect} @ {args.res}", file=sys.stderr)

    image_url = generate(args.prompt, args.aspect, args.res, use_unlim)
    print(image_url)  # stdout — pipe-friendly

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        download(image_url, out)


if __name__ == "__main__":
    main()
