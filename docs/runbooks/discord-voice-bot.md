# Runbook — Discord Voice Bot (record mode, Phase 1)

A QuiverDM-native bot that joins a campaign's Discord voice channel and records
each speaker to their own track, labelled with that speaker's **character name**
(via Discord identity), then runs the existing multi-track merge → a diarized
transcript with real names. Replaces hand-importing Craig recordings.

## Where it fits

```
Discord voice channel
  → bot subscribes per user (@discordjs/voice)  src/lib/discord/voice-bot.ts
  → Opus → PCM16, downmix mono, per-user WAV
  → storage + SessionRecording rows (speakerTag = resolved character)
  → addMultiTrackJob → multi-track-worker (local WhisperX) → merged Transcript

Control plane:
  app/tRPC  discordVoice.start/stopRecording
    → Redis pub  "discord-voice-control"
      → bot process (src/server/discord-voice-bot.ts) acts
```

The web process never holds a Discord gateway connection — the bot is its own
long-lived process (PM2), decoupled via Redis.

## Prerequisites

- A **Discord application + bot** with a token (`DISCORD_BOT_TOKEN`), invited to the
  guild with **Connect** + **Speak**/View permission on the voice channel.
- Bot needs the `Guilds` + `GuildVoiceStates` gateway intents (set in code).
- **Discord OAuth** enabled for sign-in (`DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`)
  so players' Discord ids are stored — that's what makes track labels automatic.
- Redis reachable (same as BullMQ).
- The **multi-track worker** running with `MULTITRACK_STT=whisperx` (WhisperX Python
  env on that host) — see the transcription pipeline docs.

## Configuration

Per campaign, set the Discord server + voice channel (DM-only):

```ts
trpc.discordVoice.setConfig.mutate({
  campaignId,
  discordGuildId: '111111111111111111',
  discordVoiceChannelId: '222222222222222222',
});
```

`discordGuildId` is stored on `Campaign`; the voice channel id lives in
`Campaign.settings.discordVoiceChannelId`.

## Run the bot

Local:
```bash
npm run worker:discord-voice
```
Homelab (PM2): the `discord-voice-bot` app is in
`deploy/homelab/ecosystem.config.js` — `pm2 restart discord-voice-bot`.

On start it logs `listening for control messages on "discord-voice-control"`.

## Verify end-to-end

1. **Identity** — sign in to QuiverDM with **Discord** (the "Continue with Discord"
   button). Confirm an `Account(provider='discord')` row exists for you. Link a
   character to that player in a test campaign (active `CampaignCharacter`).
2. **Config** — `discordVoice.setConfig` with the test guild + voice channel.
3. **Start** — call `discordVoice.startRecording({ campaignId, sessionId })` (the
   session must exist). The bot **joins** the channel and posts the consent notice
   ("🎙️ QuiverDM is now recording…").
4. Two people (including the linked player) **speak** for a bit.
5. **Stop** — `discordVoice.stopRecording({ campaignId, sessionId })`. The bot
   uploads per-user WAVs, creates `SessionRecording` rows, and enqueues the
   multi-track job.
6. **Result** — once the worker finishes, the session's `Transcript.speakers` are
   **character names** (the linked player shows as their character, not "Speaker 1"),
   and transcription ran on **local WhisperX** (no AssemblyAI calls).

## Notes / limits

- **Consent is mandatory** — the bot announces on join; keep that.
- **Audio:** Discord delivers 48 kHz stereo Opus; the bot downmixes to mono WAV and
  WhisperX resamples internally. Per-user WAV is uncompressed — large for long
  sessions; a FLAC/streaming-upload pass is a follow-up.
- **Deafened/muted users** aren't captured (Discord doesn't forward their audio).
- **Unknown speakers** (no linked Discord account) fall back to "Speaker N"; the DM
  can still remap them later via the existing speaker-mapping UI.

## Live captions (Phase 2, A3 hybrid)

When recording starts, the bot also opens a **live-caption feed**: it mints a
live-session token for the campaign owner, connects to the WS server
(`WS_INTERNAL_URL`, default `ws://localhost:3004`) as a client, and forwards a
16 kHz copy of each speaker's audio. Captions surface on the run sheet's
`LiveTranscriptPanel` exactly as the browser-mic path does.

- The live session is started with **`deferSave: true`**, so stopping it does **not**
  write a transcript — the authoritative transcript is the per-track merge.
- Captions are **forward-as-arrives** (not true mixed audio): overlapping speech can
  garble the ephemeral captions, but never the saved per-track transcript. True
  sample-mixing is a follow-up.
- The feed is **best-effort** — if the WS server is unreachable, recording continues
  without captions.
- Verify: with the bot recording and the run sheet open, captions appear within ~1–2 s;
  on stop, exactly **one** transcript is written (from the merge), not two.

## Related code

- `src/lib/discord/voice-bot.ts` — recorder + control handler
- `src/server/discord-voice-bot.ts` — Redis-subscriber service entry
- `src/lib/discord/identity.ts` — Discord user → character resolver (unit-tested)
- `src/server/routers/discord-voice.ts` — config + start/stop tRPC surface
- `src/lib/queue/multi-track-worker.ts` — transcribe (WhisperX) + merge
