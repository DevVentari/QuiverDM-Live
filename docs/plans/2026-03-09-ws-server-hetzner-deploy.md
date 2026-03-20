# WebSocket Server — Hetzner + Cloudflare WSS Deployment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the live transcription WebSocket server to Hetzner, expose it as `wss://ws.quiverdm.com` via Cloudflare proxy, and wire up the Vercel env var so live transcription works in production.

**Architecture:** Add `ws-server` as a second Docker Compose service on Hetzner reusing the existing workers image. Cloudflare acts as WSS/TLS terminator — no nginx needed. Vercel server-side env var `NEXT_PUBLIC_WS_URL` points to `wss://ws.quiverdm.com`; the `startLiveSession` tRPC procedure returns this URL to the browser.

**Tech Stack:** Docker Compose, Cloudflare DNS API, Vercel CLI, Node.js ws-server (tsx)

---

### Task 1: Add ws-server service to docker-compose

**Files:**
- Modify: `deploy/hetzner/docker-compose.yml`

**Step 1: Edit docker-compose.yml**

Replace the entire file with:

```yaml
services:
  workers:
    build:
      context: .
      dockerfile: Dockerfile.workers
    container_name: quiverdm-workers
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
      - TORCH_DEVICE=cpu
      - OMP_NUM_THREADS=2
      - MKL_NUM_THREADS=2
    volumes:
      - marker-models:/root/.cache/datalab
    deploy:
      resources:
        limits:
          memory: 9216M

  ws-server:
    build:
      context: .
      dockerfile: Dockerfile.workers
    container_name: quiverdm-ws
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      - NODE_OPTIONS=--max-old-space-size=512
      - WS_PORT=3004
    ports:
      - "3004:3004"
    command: npx tsx src/server/ws-server.ts
    healthcheck:
      test: ["CMD", "node", "-e", "require('net').connect(3004,'localhost',()=>process.exit(0)).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  marker-models:
```

**Step 2: Commit**

```bash
git add deploy/hetzner/docker-compose.yml
git commit -m "feat: add ws-server Docker Compose service on port 3004"
```

---

### Task 2: Add Cloudflare DNS A record for ws.quiverdm.com

**Files:** None (Cloudflare API call)

**Step 1: Read Cloudflare API key from credentials.env**

Check `C:\Users\mail\.claude\credentials.env` for `CLOUDFLARE_API_KEY` or `CLOUDFLARE_API_TOKEN`.
Zone ID for quiverdm.com: `b4ad8e64f717463806c58487b9582455`
Hetzner IP: `204.168.157.125`

**Step 2: Create the DNS record via Cloudflare API**

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/b4ad8e64f717463806c58487b9582455/dns_records" \
  -H "Authorization: Bearer <CLOUDFLARE_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "ws",
    "content": "204.168.157.125",
    "ttl": 1,
    "proxied": true
  }'
```

Expected: `"success": true` with a record ID.

---

### Task 3: Set NEXT_PUBLIC_WS_URL in Vercel

**Step 1: Add env var via Vercel CLI**

```bash
vercel env add NEXT_PUBLIC_WS_URL production
# When prompted for value: wss://ws.quiverdm.com
```

Or via Vercel dashboard: Settings → Environment Variables → add `NEXT_PUBLIC_WS_URL` = `wss://ws.quiverdm.com` for Production.

---

### Task 4: Deploy ws-server to Hetzner

**Step 1: Push to main (triggers nothing auto — workers deploy is manual)**

```bash
git push origin main
```

**Step 2: SSH and redeploy on Hetzner**

```bash
ssh root@204.168.157.125 'cd /opt/quiverdm && git pull && docker compose build ws-server && docker compose up -d ws-server'
```

**Step 3: Verify ws-server is running**

```bash
ssh root@204.168.157.125 'docker compose ps'
```

Expected: both `quiverdm-workers` and `quiverdm-ws` show `Up` status.

**Step 4: Smoke test WebSocket port from server**

```bash
ssh root@204.168.157.125 'node -e "const net=require(\"net\");const c=net.connect(3004,\"localhost\",()=>{console.log(\"OK\");process.exit(0)});c.on(\"error\",e=>{console.error(e.message);process.exit(1)})"'
```

Expected: `OK`

---

### Task 5: Redeploy Vercel to pick up env var

**Step 1: Trigger redeploy**

The env var change requires a new Vercel build. Push a trivial commit or redeploy via CLI:

```bash
vercel --prod
```

Note: if `node_modules` is too large for `vercel --prod`, push a commit to main instead — Vercel auto-deploys on push.

**Step 2: Verify env var is live**

After deploy, check the Vercel function logs or visit `/api/health` to confirm the deployment completed.

---

### Task 6: End-to-end smoke test

**Step 1: Open a session in production**

Go to `https://quiverdm.com`, open a session, attempt to start Live Transcription.

Expected: Connection established, no "ws://localhost:3004" errors, microphone prompt appears.

**Step 2: Check Cloudflare WebSocket proxying**

In browser DevTools → Network → WS tab, confirm the WebSocket connection target is `wss://ws.quiverdm.com`.

---

### Notes

- **Cloudflare 100s idle timeout**: Non-issue for live transcription since audio streams continuously. If a session sits idle for >100s, the connection drops — the client should handle reconnect (check `useLiveTranscription.ts` for reconnect logic).
- **Scaling beyond 20-30 users**: Current in-process session state is the ceiling. When needed, move live session state to Redis and add sticky sessions at load balancer.
- **WS server logs**: `docker compose logs -f ws-server` on Hetzner.
