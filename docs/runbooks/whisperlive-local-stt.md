# Runbook — Local Realtime STT (WhisperLive)

Self-hosted replacement for AssemblyAI's streaming transcription. Runs
[WhisperLive](https://github.com/collabora/WhisperLive) (faster-whisper backend)
on a GPU box and exposes a WebSocket the app's live-session manager streams to.
This kills the per-hour cloud STT cost; batch recording transcription already
runs locally via WhisperX.

## Where it fits

```
Browser (DM mic)
  → PCM16 mono frames over WS  (src/hooks/useLiveCapture.ts)
  → app WS server :3004        (src/server/websocket.ts)
  → liveSessionManager.sendAudio
  → realtime-provider.ts  ──STT_REALTIME_PROVIDER──┐
       ├─ local      → local-realtime.ts ─→ WhisperLive :9090 (this runbook)
       └─ assemblyai → assemblyai.ts     ─→ AssemblyAI cloud
```

The app converts Int16 → Float32 and resamples to 16 kHz in `local-realtime.ts`,
so WhisperLive always receives the float32 @ 16 kHz mono it expects.

## Prerequisites

- A host with an NVIDIA GPU (RTX 4070 / 12 GB is comfortable) reachable from the
  app WS server. Ideal: homelab LXC/VM with GPU passthrough, alongside Ollama.
- NVIDIA driver + `nvidia-container-toolkit` installed (for the Docker path).

## Deploy (Docker, recommended)

```bash
docker run -d --restart unless-stopped \
  --name whisperlive \
  --gpus all \
  -p 9090:9090 \
  ghcr.io/collabora/whisperlive-gpu:latest \
  python3 run_server.py --port 9090 --backend faster_whisper
```

Model is selected per-connection by the client (the app sends `WHISPERLIVE_MODEL`
in its config frame), so you do not bake a model into the container. faster-whisper
downloads and caches the requested model on first use — mount a volume to persist it:

```bash
  -v whisperlive-models:/root/.cache/huggingface
```

## Model choice (RTX 4070, 12 GB)

| Model (`WHISPERLIVE_MODEL`) | ~VRAM (CT2 fp16) | Latency | Notes |
| --- | --- | --- | --- |
| `large-v3` | ~4.5 GB | ~1–2 s | Best accuracy; default |
| `large-v3-turbo` | ~2–3 GB | ~0.8–1.5 s | Near-large accuracy, faster — best table feel |
| `distil-large-v3` | ~1.5 GB | ~0.8 s | English-only, fastest |

Start on `large-v3`; drop to `large-v3-turbo` if latency at the table feels high.

## App configuration

In `.env.local` on the app/WS server:

```env
STT_REALTIME_PROVIDER=local
WHISPERLIVE_URL=ws://192.168.1.21:9090
WHISPERLIVE_MODEL=large-v3-turbo
```

To fall back to cloud at any time, flip one line:

```env
STT_REALTIME_PROVIDER=assemblyai   # ASSEMBLYAI_API_KEY must be set
```

No code or restart of the browser client is needed — the next "Go live" session
uses the new provider.

## Verify

1. **Server health** — from the WS host:
   ```bash
   # SERVER_READY should come back after the config frame
   wscat -c ws://192.168.1.21:9090
   > {"uid":"smoke","language":"en","task":"transcribe","model":"large-v3-turbo","use_vad":true}
   ```
2. **End-to-end** — in the app, open a session in `in_progress`, hit **Go live**,
   speak. Captions should appear within ~1–2 s on the run sheet
   (`LiveTranscriptPanel`). On stop, the accumulated transcript is saved (same
   `saveTranscript` path as before).
3. **GPU in use** — `nvidia-smi` on the host shows a python process holding VRAM
   while a session is live.

## Notes / limits

- **Diarization (speaker labels):** the realtime path does not label speakers
  (neither did the AssemblyAI realtime path — `turn.speaker` was never set). The
  *saved* recording still gets full speaker diarization via the batch WhisperX
  pipeline. No regression.
- **Concurrency:** one WhisperLive worker handles one stream at a time well; it
  queues extras and replies `WAIT`. For multiple simultaneous live sessions, run
  more replicas behind a load balancer or raise the server's worker count.
- **Latency tuning:** lower `send_last_n_segments` and use `large-v3-turbo` for
  the snappiest captions; the app sets `use_vad: true` so silence doesn't burn GPU.

## Related code

- `src/lib/transcription/local-realtime.ts` — the WhisperLive adapter + pure
  `mapWhisperLiveSegments` (unit-tested in `__tests__/local-realtime.test.ts`)
- `src/lib/transcription/realtime-provider.ts` — `STT_REALTIME_PROVIDER` selector
- `src/lib/transcription/live-session-manager.ts` — provider-agnostic session manager
- `src/hooks/useLiveCapture.ts` — browser PCM16 capture (prefers 16 kHz)
